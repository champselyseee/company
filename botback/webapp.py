"""Веб-сервер бота для мини-аппы (Telegram WebApp) и вебхука оплаты.

Бот работает по long-polling и параллельно (в том же процессе и event loop) поднимает
маленький aiohttp-сервер — он обслуживает мини-аппу (Telegram initData, без токенов)
и вебхук ЮKassa. Доступ/списание/проверка/начисление — в общем core/ (не дублируем).
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import io
import json
import logging
import time
from urllib.parse import parse_qsl

from aiohttp import web

from . import config

try:  # как пакет (core.db) или как одиночные модули — как в остальном коде бота
    from core import db, grok, grok_check
except ImportError:  # pragma: no cover
    import db, grok, grok_check  # type: ignore

log = logging.getLogger(__name__)

INIT_DATA_MAX_AGE = 24 * 60 * 60  # initData свежее суток — защита от переигрывания
# Максимум тела запроса: фото (base64) + PDF-вложение легко превышают дефолтный 1 МБ aiohttp.
MAX_BODY_SIZE = 16 * 1024 * 1024  # 16 МБ


# ── Проверка подписи Telegram WebApp initData ──

_secret_key: bytes | None = None


def _webapp_secret() -> bytes | None:
    """secret_key = HMAC_SHA256(key='WebAppData', msg=bot_token). Кэшируем: токен постоянный."""
    global _secret_key
    if _secret_key is None:
        if not config.TELEGRAM_TOKEN:
            return None
        _secret_key = hmac.new(
            b"WebAppData", config.TELEGRAM_TOKEN.encode(), hashlib.sha256
        ).digest()
    return _secret_key


def verify_init_data(init_data: str) -> dict | None:
    """Проверяет подпись initData от Telegram WebApp.

    Возвращает {telegram_id, username} при валидной подписи, иначе None. Telegram считает
    hash по всем полям, КРОМЕ самого hash. Поле signature (Ed25519 для третьих сторон) в
    разных версиях клиента то входит в data_check_string, то нет — поэтому проверяем оба
    варианта. secret = HMAC_SHA256(key='WebAppData', msg=bot_token).

    На каждый неуспех пишем в лог ПРИЧИНУ (level WARNING) — чтобы в логах Railway было
    видно, почему мини-аппа получает 401 (пустая подпись / чужой бот / просрочка / т.д.).
    """
    secret_key = _webapp_secret()
    if secret_key is None:
        log.warning("initData: TELEGRAM_TOKEN не задан — проверять подпись нечем")
        return None
    if not init_data:
        log.warning("initData: пустая строка (аппа открыта без подписи Telegram?)")
        return None

    data = dict(parse_qsl(init_data, keep_blank_values=True))  # значения раскодированы
    received_hash = data.pop("hash", None)
    signature = data.pop("signature", None)  # Ed25519-подпись для третьих сторон
    if not received_hash:
        log.warning("initData: нет поля hash. Присланные поля: %s", sorted(data))
        return None

    def _calc(include_signature: bool) -> str:
        items = dict(data)
        if include_signature and signature is not None:
            items["signature"] = signature
        dcs = "\n".join(f"{k}={v}" for k, v in sorted(items.items()))
        return hmac.new(secret_key, dcs.encode(), hashlib.sha256).hexdigest()

    # Считаем hash ДВУМЯ способами: без signature (как в доке) и с ним — Telegram в
    # разных версиях трактует по-разному. Достаточно совпадения любого варианта.
    calc_no_sig = _calc(False)
    calc_with_sig = _calc(True)
    if not (
        hmac.compare_digest(calc_no_sig, received_hash)
        or hmac.compare_digest(calc_with_sig, received_hash)
    ):
        log.warning(
            "initData: hash НЕ совпал. recv=%s calc_no_sig=%s calc_with_sig=%s "
            "auth_date=%s query_id=%s user=%r",
            received_hash, calc_no_sig, calc_with_sig,
            data.get("auth_date"), data.get("query_id"), data.get("user"),
        )
        return None

    try:  # initData не старше суток
        age = time.time() - int(data.get("auth_date", "0"))
    except (TypeError, ValueError):
        log.warning("initData: некорректный auth_date=%r", data.get("auth_date"))
        return None
    if age > INIT_DATA_MAX_AGE:
        log.warning("initData: просрочена — возраст %.1f ч (лимит 24 ч)", age / 3600)
        return None

    try:  # поле user — JSON-строка с данными аккаунта
        user = json.loads(data.get("user", ""))
        telegram_id = int(user["id"])
    except (ValueError, KeyError, TypeError):
        log.warning("initData: не разобрать поле user=%r", data.get("user"))
        return None
    log.info("initData: OK, telegram_id=%s, возраст %.0f c", telegram_id, age)
    return {"telegram_id": telegram_id, "username": user.get("username")}


# ── CORS + аутентификация запроса ──

def _cors() -> dict:
    return {
        "Access-Control-Allow-Origin": config.WEBAPP_ALLOWED_ORIGIN,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
    }


def _json(data, status: int = 200):
    return web.json_response(data, status=status, headers=_cors())


async def _auth(request) -> dict | None:
    """initData из заголовка 'Authorization: tma <initData>' → строка users из БД, либо None."""
    auth = request.headers.get("Authorization", "")
    if auth[:4].lower() == "tma ":
        init_data = auth[4:].strip()
    else:
        init_data = ""
        log.warning(
            "api %s: нет заголовка 'Authorization: tma ...' (получено начало: %r)",
            request.path, auth[:16],
        )
    ident = verify_init_data(init_data)
    if ident is None:
        return None
    # core.db синхронный (psycopg) — уводим в поток, чтобы не блокировать event loop.
    return await asyncio.to_thread(
        db.get_or_create_telegram_user, ident["telegram_id"], ident["username"]
    )


def _extract_file_text(file) -> tuple[str | None, str | None]:
    """(file_name, file_text) из вложения мини-аппы. PDF → pypdf, text/* → decode.

    Синхронная (pypdf CPU-bound) — вызывать через asyncio.to_thread. Что не разобрали —
    молча игнорируем (file_text=None), не падаем.
    """
    if not isinstance(file, dict):
        return None, None
    name = file.get("name") or "файл"
    data_url = file.get("data") or ""
    if "," not in data_url:
        return name, None
    try:
        raw = base64.b64decode(data_url.split(",", 1)[1])
    except Exception:
        return name, None
    ctype = (file.get("type") or "").lower()
    lname = name.lower()
    if "pdf" in ctype or lname.endswith(".pdf"):
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(raw))
            text = "\n".join((p.extract_text() or "") for p in reader.pages).strip()
            return name, text or None
        except Exception:
            return name, None
    if ctype.startswith("text/") or lname.endswith(".txt"):
        return name, raw.decode("utf-8", errors="ignore").strip() or None
    return name, None


# ── Эндпоинты мини-аппы ──

async def handle_options(request):
    return web.Response(status=204, headers=_cors())


async def handle_health(request):
    return web.json_response({"ok": True, "service": "botback-webapp"})


async def handle_me(request):
    """Кто я, сколько проверок осталось и публичный счётчик (для UI мини-аппы)."""
    user = await _auth(request)
    if user is None:
        return _json({"error": "unauthorized"}, 401)
    total = await asyncio.to_thread(db.get_total_checks)  # публичный счётчик «работ проверено»
    sub = db.has_subscription(user)
    free_left = 0 if user.get("free_used") else 1
    paid = user.get("paid_checks", 0) or 0
    sub_left = db.subscription_left(user)  # 0, если подписки нет
    return _json({
        "username": user.get("username"),
        "subscription": sub,
        "checksLeft": sub_left + free_left + paid,  # всего доступно сейчас
        "totalChecks": total,
    })


async def handle_check(request):
    """Проверка работы. Списываем В МОМЕНТ проверки: резерв → ИИ → возврат при сбое."""
    user = await _auth(request)
    if user is None:
        return _json({"error": "unauthorized"}, 401)
    try:
        body = await request.json()
    except Exception:
        return _json({"error": "bad_json"}, 400)

    work_type = body.get("type") or body.get("workType")
    text = (body.get("text") or "").strip()
    photos = body.get("photos") or None
    # Разбор вложения (pypdf) CPU-bound — в поток, чтобы не блокировать event loop (на нём polling).
    file_name, file_text = await asyncio.to_thread(_extract_file_text, body.get("file"))
    if work_type not in ("email", "essay", "composition"):
        return _json({"error": "unknown_type"}, 400)
    if not text and not photos and not file_text:
        return _json({"error": "empty_work"}, 400)

    user_id = user["id"]  # ВНУТРЕННИЙ users.id (не telegram_id)
    kind = await asyncio.to_thread(db.consume_check, user_id)  # резерв ДО обращения к ИИ
    if kind is None:
        return _json({"error": "no_checks"}, 402)  # проверки закончились
    try:
        answer = await grok_check.check_work(
            user_id, work_type, text=text, photos=photos,
            file_name=file_name, file_text=file_text, source="bot",
        )
    except grok_check.GrokCheckError as e:
        await asyncio.to_thread(db.refund_check, user_id, kind)  # ИИ не ответил — вернуть
        return _json({"error": str(e)}, 502)
    except Exception:
        await asyncio.to_thread(db.refund_check, user_id, kind)
        log.exception("Проверка через мини-аппу не удалась (user_id=%s)", user_id)
        return _json({"error": "server_error"}, 500)
    return _json({"answer": answer})


async def handle_ocr(request):
    """Распознавание фото рукописи (в базу не пишет, проверку не списывает)."""
    user = await _auth(request)
    if user is None:
        return _json({"error": "unauthorized"}, 401)
    try:
        body = await request.json()
    except Exception:
        return _json({"error": "bad_json"}, 400)
    try:
        text = await grok.ocr(body.get("photo") or "")
    except grok.GrokError as e:
        return _json({"error": str(e)}, 502)
    return _json({"text": text})


# ── Вебхук ЮKassa (оплата) ──

async def handle_yukassa_webhook(request):
    """Уведомление ЮKassa (payment.succeeded) → начисление в общий Postgres.

    Тело доверяем (как в старом боте). ВСЕГДА отвечаем 200, иначе ЮKassa шлёт повторы.
    Платёж создаёт магазин с metadata.user_id (Telegram id) и metadata.payload.
    Идемпотентность — через mark_payment_processed (ЮKassa может слать повторы).
    """
    try:
        body = await request.json()
    except Exception:
        return web.Response(status=400)
    if body.get("event") != "payment.succeeded":
        return web.Response(status=200)  # не наше событие — просто подтверждаем
    obj = body.get("object") or {}
    meta = obj.get("metadata") or {}
    payment_id = obj.get("id")
    payload = meta.get("payload") or ""
    try:
        tg_id = int(meta.get("user_id", 0))
    except (TypeError, ValueError):
        tg_id = 0
    if not payment_id or not tg_id or not payload:
        return web.Response(status=200)

    def _grant() -> None:
        user = db.get_or_create_telegram_user(tg_id)
        uid = user["id"]
        # Идемпотентность: повторные уведомления НЕ начисляют дважды.
        if not db.mark_payment_processed(payment_id, user_id=uid, provider="yookassa"):
            return
        if payload == "rub_month":
            db.add_subscription(uid, 30)
        elif payload == "rub_5":
            db.add_paid_checks(uid, 5)
        else:
            db.add_paid_checks(uid, 1)
        db.reward_referrer(uid)  # реферальный бонус (идемпотентно по флагу rewarded)

    await asyncio.to_thread(_grant)
    return web.Response(status=200)


# ── Сборка и запуск сервера ──

def build_app() -> web.Application:
    # client_max_size поднят с дефолтного 1 МБ: тело с фото(base64)/PDF бывает больше.
    app = web.Application(client_max_size=MAX_BODY_SIZE)
    app.router.add_get("/", handle_health)
    app.router.add_get("/api/me", handle_me)
    app.router.add_post("/api/check", handle_check)
    app.router.add_post("/api/ocr", handle_ocr)
    app.router.add_post("/yukassa/webhook", handle_yukassa_webhook)  # вебхук оплаты
    app.router.add_route("OPTIONS", "/api/{tail:.*}", handle_options)  # префлайт CORS
    return app


async def run_web() -> None:
    runner = web.AppRunner(build_app())
    await runner.setup()
    await web.TCPSite(runner, "0.0.0.0", config.PORT).start()
    log.info("Веб-сервер мини-аппы запущен на порту %s", config.PORT)
