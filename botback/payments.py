"""Страховка начислений бота: раз в минуту переспрашиваем ЮKassa о своих неоплаченных платежах.

Обычно проверки начисляет вебхук ЮKassa (webapp.py). Если уведомление задержалось или не
пришло вовсе (например, в кабинете магазина не указан адрес), этот цикл сам увидит оплату и
начислит — тем же кодом и ровно один раз (core/yookassa.sync_payment, как опрос на сайте).
Покупатель получает то же «✅ Оплата прошла», что и после вебхука.

Смотрим только платежи бота (purchases.source = 'bot') — их проверяем ключами магазина бота.
Свежие (до 30 мин) — каждую минуту, старше — раз в 10 минут, старше суток — бросаем.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from . import notify

try:  # как пакет (core.*) или как одиночные модули
    from core import db, yookassa
except ImportError:  # pragma: no cover
    import db, yookassa  # type: ignore

log = logging.getLogger(__name__)

CHECK_EVERY_SECONDS = 60
FIRST_CHECK_DELAY_SECONDS = 30          # после старта даём боту спокойно подняться
MAX_AGE = timedelta(days=1)             # брошенный платёж дольше суток не спрашиваем
SLOW_AFTER = timedelta(minutes=30)      # после 30 минут — реже
SLOW_EVERY = timedelta(minutes=10)

_last_checked: dict[str, datetime] = {}  # payment_id → когда последний раз спрашивали ЮKassa


def _due(row: dict, now: datetime) -> bool:
    if now - row["created_at"] < SLOW_AFTER:
        return True
    last = _last_checked.get(row["payment_id"])
    return last is None or now - last >= SLOW_EVERY


async def sync_pending(bot) -> int:
    """Один проход по неоплаченным платежам бота. Возвращает число НОВЫХ начислений."""
    if not yookassa.configured():
        return 0
    rows = await asyncio.to_thread(db.pending_purchases, "bot", MAX_AGE)
    now = datetime.now(timezone.utc)
    granted = 0
    for row in rows:
        pid = row["payment_id"]
        if not _due(row, now):
            continue
        _last_checked[pid] = now
        try:
            grant = await yookassa.sync_payment(pid)
        except yookassa.YooKassaError as e:
            log.warning("Страховка оплат: не удалось проверить платёж %s: %s", pid, e)
            continue
        if grant:
            granted += 1
            log.info("Страховка оплат: платёж %s начислен без вебхука", pid)
            await notify.notify_buyer(bot, grant)
            await notify.notify_referrer(bot, grant.get("referrer_id"))
    live = {r["payment_id"] for r in rows}
    for pid in list(_last_checked):
        if pid not in live:  # оплачен, отменён или устарел — больше не нужен
            del _last_checked[pid]
    return granted


async def run_loop(bot) -> None:
    """Бесконечный цикл страховки. Без ключей ЮKassa (YUKASSA_*) ничего не делает."""
    await asyncio.sleep(FIRST_CHECK_DELAY_SECONDS)
    while True:
        try:
            await sync_pending(bot)
        except Exception:
            log.exception("Страховка оплат: сбой прохода, повторим через минуту")
        await asyncio.sleep(CHECK_EVERY_SECONDS)
