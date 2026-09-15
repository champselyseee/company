"""Оплата через ЮKassa — общий модуль для бота и сайта.

  • create_payment — создаёт платёж по тарифу из core/catalog.py (сумму решает сервер)
    и возвращает ссылку на страницу оплаты;
  • handle_notification — обработка HTTP-уведомления ЮKassa. Телу уведомления НЕ верим:
    берём из него только id и переспрашиваем платёж в API ЮKassa. Начисляем, только если
    там status=succeeded, paid=true и сумма совпадает с тарифом — ровно один раз
    (db.grant_payment, защита от повторных уведомлений).

Ключи магазина из переменных окружения: YUKASSA_SHOP_ID, YUKASSA_SECRET.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import uuid
from decimal import Decimal, InvalidOperation

import httpx

try:  # как пакет (core.*) или как одиночные модули — как в остальном core/
    from core import catalog, db
except ImportError:  # pragma: no cover
    import catalog, db  # type: ignore

log = logging.getLogger(__name__)

API_URL = "https://api.yookassa.ru/v3"
TIMEOUT = 30.0
_transport: httpx.AsyncBaseTransport | None = None  # подменяется в тестах (httpx.MockTransport)
_PAYMENT_ID_RE = re.compile(r"^[0-9A-Za-z-]{10,64}$")

# Старые платежи: их создавал прежний бот (backendmirrr) с metadata.user_id = Telegram id
# и payload. Принимаем, чтобы не потерять оплаты переходного периода (логика как раньше).
LEGACY_PAYLOADS = {
    "rub_1": {"checks": 1, "days": 0, "title": "1 проверка"},
    "rub_5": {"checks": 5, "days": 0, "title": "5 проверок"},
    "rub_month": {"checks": 0, "days": 30, "title": "подписка на месяц"},
}
LEGACY_DEFAULT = {"checks": 1, "days": 0, "title": "1 проверка"}


class YooKassaError(Exception):
    """Ошибка ЮKassa с понятным текстом."""


def _env(name: str) -> str:
    return (os.environ.get(name) or "").strip()


SHOP_ID = _env("YUKASSA_SHOP_ID")
SECRET = _env("YUKASSA_SECRET")


def configured() -> bool:
    return bool(SHOP_ID and SECRET)


async def _request(method: str, path: str, *, json: dict | None = None, headers: dict | None = None) -> dict:
    if not configured():
        raise YooKassaError("ЮKassa не настроена (нет YUKASSA_SHOP_ID / YUKASSA_SECRET)")
    try:
        async with httpx.AsyncClient(
            base_url=API_URL, timeout=TIMEOUT, auth=(SHOP_ID, SECRET), transport=_transport
        ) as client:
            resp = await client.request(method, path, json=json, headers=headers)
    except httpx.HTTPError as e:
        raise YooKassaError("Нет связи с ЮKassa") from e
    if resp.status_code >= 400:
        log.warning("ЮKassa %s %s → %s: %s", method, path, resp.status_code, resp.text[:300])
        raise YooKassaError(f"ЮKassa ответила ошибкой {resp.status_code}")
    return resp.json()


async def create_payment(user_id: int, kind: str, offer_id: str, return_url: str, source: str) -> str:
    """Создаёт платёж для users.id по тарифу и возвращает confirmation_url (страница оплаты)."""
    offer = catalog.get_offer(kind, offer_id)
    if offer is None:
        raise YooKassaError("Неизвестный тариф")
    body = {
        "amount": {"value": f"{Decimal(offer['price']):.2f}", "currency": "RUB"},
        "capture": True,
        "confirmation": {"type": "redirect", "return_url": return_url},
        "description": f"Expert ЕГЭ: {offer['title']}"[:128],
        "metadata": {"uid": str(user_id), "kind": kind, "offer": offer_id, "source": source},
    }
    data = await _request("POST", "/payments", json=body, headers={"Idempotence-Key": str(uuid.uuid4())})
    url = (data.get("confirmation") or {}).get("confirmation_url")
    if not url:
        raise YooKassaError("ЮKassa не вернула ссылку на оплату")
    log.info("ЮKassa: создан платёж %s (uid=%s, %s:%s, %s ₽, %s)",
             data.get("id"), user_id, kind, offer_id, offer["price"], source)
    return url


async def fetch_payment(payment_id: str) -> dict:
    return await _request("GET", f"/payments/{payment_id}")


def _grant_sync(payment_id: str, meta: dict, amount: dict) -> dict | None:
    """Проверка metadata/суммы и начисление (синхронно — core.db на psycopg)."""
    try:
        value = Decimal(str(amount.get("value")))
    except (InvalidOperation, TypeError):
        value = None
    if "uid" in meta:  # новый формат: платёж создан create_payment
        offer = catalog.get_offer(str(meta.get("kind", "")), str(meta.get("offer", "")))
        try:
            uid = int(meta["uid"])
        except (TypeError, ValueError):
            offer = None
        if offer is None:
            log.warning("ЮKassa: платёж %s с непонятной metadata %s — не начисляем", payment_id, meta)
            return None
        if amount.get("currency") != "RUB" or value != Decimal(offer["price"]):
            log.warning("ЮKassa: платёж %s на %s %s не совпадает с тарифом %s:%s (%s ₽) — не начисляем",
                        payment_id, amount.get("value"), amount.get("currency"), offer["kind"], offer["id"], offer["price"])
            return None
        user = db.get_user_by_id(uid)
        if user is None:
            log.warning("ЮKassa: платёж %s для несуществующего пользователя %s", payment_id, uid)
            return None
        checks, days, quota, title = offer["checks"], offer["days"], offer["quota"], offer["title"]
    elif "user_id" in meta:  # старый формат прежнего бота
        try:
            tg_id = int(meta["user_id"])
        except (TypeError, ValueError):
            log.warning("ЮKassa: платёж %s со старой metadata без Telegram id", payment_id)
            return None
        legacy = LEGACY_PAYLOADS.get(str(meta.get("payload") or ""), LEGACY_DEFAULT)
        user = db.get_or_create_telegram_user(tg_id)
        uid = user["id"]
        checks, days, quota, title = legacy["checks"], legacy["days"], None, legacy["title"]
    else:
        log.warning("ЮKassa: платёж %s без metadata покупателя — не начисляем", payment_id)
        return None

    if not db.grant_payment(payment_id, uid, value, checks=checks, days=days, quota=quota):
        return None  # это уведомление уже обработано раньше
    referrer_id = db.reward_referrer(uid)  # идемпотентно (флаг rewarded)
    log.info("ЮKassa: платёж %s — пользователю %s начислено: %s", payment_id, uid, title)
    return {"user_id": uid, "telegram_id": user.get("telegram_id"), "title": title, "referrer_id": referrer_id}


async def handle_notification(body) -> dict | None:
    """Обработать уведомление ЮKassa. Возвращает данные о НОВОМ начислении, иначе None.

    Бросает YooKassaError, если платёж не удалось проверить (нет связи с API): тогда
    вебхук отвечает 5xx, и ЮKassa пришлёт уведомление повторно.
    """
    if not isinstance(body, dict) or body.get("event") != "payment.succeeded":
        return None
    payment_id = str((body.get("object") or {}).get("id") or "")
    if not _PAYMENT_ID_RE.match(payment_id):
        log.warning("ЮKassa: уведомление с некорректным id платежа %r", payment_id[:80])
        return None
    payment = await fetch_payment(payment_id)
    if payment.get("status") != "succeeded" or payment.get("paid") is not True:
        log.warning("ЮKassa: уведомление об оплате %s, но в API статус %s — не начисляем",
                    payment_id, payment.get("status"))
        return None
    return await asyncio.to_thread(
        _grant_sync, payment_id, payment.get("metadata") or {}, payment.get("amount") or {}
    )
