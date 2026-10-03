"""Сообщения об оплате в Telegram: покупателю («Оплата прошла», баланс до → после) и
пригласившему (бонус). Общие для вебхука ЮKassa (webapp.py) и страховочной проверки
платежей (payments.py) — кто бы ни начислил, человек получает одно и то же сообщение.
"""

from __future__ import annotations

import asyncio
import logging

from .keyboards import with_purchases_keyboard

try:  # как пакет (core.db) или как одиночный модуль — как в остальном коде бота
    from core import db
except ImportError:  # pragma: no cover
    import db  # type: ignore

log = logging.getLogger(__name__)


def buyer_text(grant: dict) -> str:
    """«✅ Оплата прошла: 5 проверок. / Баланс: 1 → 6» — как уведомление о зачислении на сайте."""
    text = f"✅ Оплата прошла: {grant['title']}."
    before, after = grant.get("balance_before"), grant.get("balance_after")
    if before is not None and after is not None:
        text += f"\nБаланс: {before} → {after}"
    return text + "\n\nПроверить работу — кнопка ниже 👇"


async def notify_buyer(bot, grant: dict) -> None:
    """Пишет покупателю в Telegram, что оплата прошла (если у него есть Telegram). Сбой — только лог."""
    if bot is None or not grant.get("telegram_id"):
        return
    try:
        await bot.send_message(
            chat_id=grant["telegram_id"], text=buyer_text(grant), reply_markup=with_purchases_keyboard()
        )
    except Exception:
        log.warning("Не удалось уведомить покупателя (users.id=%s)", grant.get("user_id"), exc_info=True)


async def notify_referrer(bot, referrer_id: int | None) -> None:
    """Пишет пригласившему в Telegram, что ему начислен бонус. Сбой не критичен — только лог."""
    if bot is None or referrer_id is None:
        return
    try:
        referrer = await asyncio.to_thread(db.get_user_by_id, referrer_id)
        if referrer and referrer.get("telegram_id"):
            await bot.send_message(
                chat_id=referrer["telegram_id"],
                text=(
                    "🎉 Друг, которого ты пригласил, купил проверки — "
                    "тебе начислена 1 проверка в подарок!\n\nПроверить работу — /start"
                ),
            )
    except Exception:
        log.warning("Не удалось уведомить пригласившего (users.id=%s)", referrer_id, exc_info=True)
