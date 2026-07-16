"""Веб-сервер бота для мини-аппы (Telegram WebApp).

Бот работает по long-polling и параллельно (в том же процессе и event loop) поднимает
маленький aiohttp-сервер — он обслуживает мини-аппу. Пользователь опознаётся по Telegram
initData (подписанные данные WebApp), без токенов. Доступ/списание/проверка — в общем core/
(не дублируем): db.consume_check / db.refund_check, grok_check.check_work, grok.ocr.
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
    hash по всем полям, КРОМЕ самого hash и поля signature (Ed25519-подпись для третьих
    сторон) — поэтому убираем оба. secret = HMAC_SHA256(key='WebAppData', msg=bot_token).
    """
    secret_key = _webapp_secret()
    if not init_data or secret_key is None:
        return None

    data = dict(parse_qsl(init_data, keep_blank_values=True))  # значения раскодированы
    received_hash = data.pop("hash", None)
    data.pop("signature", None)  # signature НЕ входит в data_check_string
    if not received_hash:
        return None

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(data.items()))
    calc_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(calc_hash, received_hash):
        return None

    try:  # initData не старше суток
        if time.time() - int(data.get("auth_date", "0")) > INIT_DATA_MAX_AGE:
            return None
    except (TypeError, ValueError):
        return None

    try:  # поле user — JSON-строка с данными аккаунта
        user = json.loads(data.get("user", ""))
        telegram_id = int(user["id"])
    except (ValueError, KeyError, TypeError):
        return None
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
    init_data = auth[4:].strip() if auth[:4].lower() == "tma " else ""
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


# ── Эндпоинты ──

async def handle_options(request):
    return web.Response(status=204, headers=_cors())


async def handle_health(request):
    return web.json_response({"ok": True, "service": "botback-webapp"})


async def handle_me(request):
    """Кто я и сколько проверок осталось (для UI мини-аппы)."""
    user = await _auth(request)
    if user is None:
        return _json({"error": "unauthorized"}, 401)
    sub = db.has_subscription(user)  # читает поля user, без запроса в БД
    free_left = 0 if user.get("free_used") else 1
    paid = user.get("paid_checks", 0) or 0
    return _json({
        "username": user.get("username"),
        "subscription": sub,
        "checksLeft": None if sub else free_left + paid,  # None = безлимит (подписка)
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


# ── Сборка и запуск сервера ──

def build_app() -> web.Application:
    # client_max_size поднят с дефолтного 1 МБ: тело с фото(base64)/PDF бывает больше.
    app = web.Application(client_max_size=MAX_BODY_SIZE)
    app.router.add_get("/", handle_health)
    app.router.add_get("/api/me", handle_me)
    app.router.add_post("/api/check", handle_check)
    app.router.add_post("/api/ocr", handle_ocr)
    app.router.add_route("OPTIONS", "/api/{tail:.*}", handle_options)  # префлайт CORS
    return app


async def run_web() -> None:
    runner = web.AppRunner(build_app())
    await runner.setup()
    await web.TCPSite(runner, "0.0.0.0", config.PORT).start()
    log.info("Веб-сервер мини-аппы запущен на порту %s", config.PORT)
