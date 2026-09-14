"""Напоминания в Telegram: «давно не проверял работу» и «подписка скоро закончится».

Фоновая задача в том же процессе, что и бот: раз в час спрашивает базу, кому пора
напомнить, и шлёт сообщения — только днём по Москве. Кому и сколько раз уже писали,
хранится в users, поэтому перезапуск бота повторов не даёт. Правила (сроки, лимиты) —
в core/db.py: claim_inactive_reminders / claim_subscription_end_reminders.
"""

import asyncio
import logging
import math
from datetime import datetime, timedelta, timezone

from telegram.error import Forbidden, TelegramError

from . import config
from .keyboards import main_keyboard

# Общая база из core/. Пробуем как пакет (core.db) и как одиночный модуль (db).
try:
    from core import db
except ImportError:
    import db

log = logging.getLogger(__name__)

# Москва без перехода на летнее время — фиксированный сдвиг (в slim-образе может не быть базы поясов).
MSK = timezone(timedelta(hours=3), "MSK")
SEND_FROM_HOUR, SEND_TO_HOUR = 10, 20  # шлём с 10:00 до 20:00 по Москве
CHECK_EVERY_SECONDS = 60 * 60          # раз в час
FIRST_CHECK_DELAY_SECONDS = 60         # после старта даём боту спокойно подняться
SEND_PAUSE_SECONDS = 0.1               # пауза между сообщениями — не упираемся в лимиты Telegram


def is_daytime(now: datetime | None = None) -> bool:
    """True, если сейчас дневные часы по Москве (когда можно слать напоминания)."""
    hour = (now or datetime.now(timezone.utc)).astimezone(MSK).hour
    return SEND_FROM_HOUR <= hour < SEND_TO_HOUR


def inactive_text() -> str:
    text = (
        "✍️ Давно не проверял работу? Пришли новое письмо, эссе или сочинение — "
        "разберу по критериям ЕГЭ. Кнопка ниже 👇"
    )
    if config.SITE_URL:
        text += f"\n\n🌐 Аргументы и разборы для подготовки — на сайте {config.SITE_DOMAIN}"
    return text


def subscription_end_text(until: datetime, now: datetime | None = None) -> str:
    now = now or datetime.now(timezone.utc)
    days = max(1, math.ceil((until - now).total_seconds() / 86400))
    date = until.astimezone(MSK).strftime("%d.%m")
    return (
        f"📅 Подписка закончится {date} — осталось дней: {days}.\n\n"
        "Успей использовать проверки 👇"
    )


async def _send(bot, row: dict, text: str) -> bool:
    """Отправляет одно напоминание. Сбои (бот заблокирован и т.п.) — только в лог."""
    if config.is_whitelisted(row.get("username")):
        return False  # команде проекта не напоминаем
    try:
        await bot.send_message(chat_id=row["telegram_id"], text=text, reply_markup=main_keyboard())
        return True
    except Forbidden:
        log.info("Напоминание: пользователь %s заблокировал бота", row["id"])
    except TelegramError:
        log.warning("Напоминание: не удалось отправить пользователю %s", row["id"], exc_info=True)
    finally:
        await asyncio.sleep(SEND_PAUSE_SECONDS)
    return False


async def send_due_reminders(bot) -> int:
    """Один проход: забирает из базы, кому пора, и отправляет. Возвращает число отправленных."""
    sent = 0
    for row in await asyncio.to_thread(db.claim_subscription_end_reminders):
        sent += await _send(bot, row, subscription_end_text(row["subscription_until"]))
    for row in await asyncio.to_thread(db.claim_inactive_reminders):
        sent += await _send(bot, row, inactive_text())
    return sent


async def run_loop(bot) -> None:
    """Бесконечный цикл напоминаний. Выключается переменной REMINDERS_ENABLED=0."""
    if not config.REMINDERS_ENABLED:
        log.info("Напоминания выключены (REMINDERS_ENABLED)")
        return
    await asyncio.sleep(FIRST_CHECK_DELAY_SECONDS)
    try:
        # Схему обновляет при старте сайт; если он ещё не перезапускался, колонок
        # напоминаний может не быть. init_schema идемпотентна — безопасно.
        await asyncio.to_thread(db.init_schema)
    except Exception:
        log.exception("Напоминания: init_schema не удался")
    while True:
        try:
            if is_daytime():
                sent = await send_due_reminders(bot)
                if sent:
                    log.info("Напоминания: отправлено %s", sent)
        except Exception:
            log.exception("Напоминания: сбой прохода, повторим через час")
        await asyncio.sleep(CHECK_EVERY_SECONDS)
