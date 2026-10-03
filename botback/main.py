"""Точка входа бэкенда бота: сборка приложения PTB, регистрация хендлеров, запуск.

Бот работает по long-polling И поднимает рядом (в том же процессе) aiohttp-веб-сервер
для мини-аппы (эндпоинты initData) — см. botback/webapp.py. Общий core/ зовём напрямую.
Проверка работ — только через мини-аппу; в чате остались служебные команды.

Запуск: python -m botback.main   (из корня репозитория, чтобы был виден пакет core/)
"""

import asyncio
import logging

from telegram.ext import (
    ApplicationBuilder,
    CallbackQueryHandler,
    CommandHandler,
    MessageHandler,
    filters,
)

from . import config, payments, reminders
from .handlers import commands, feedback
from .webapp import run_web

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
# httpx на INFO пишет каждый запрос с полным адресом, а в адресе Bot API — токен бота
# (…/bot<токен>/getUpdates раз в 10 секунд). Оставляем от него только предупреждения и ошибки.
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger(__name__)


def build_application():
    """Собирает приложение python-telegram-bot и регистрирует все хендлеры."""
    if not config.TELEGRAM_TOKEN:
        raise RuntimeError("TELEGRAM_TOKEN не задан (переменная окружения).")

    app = ApplicationBuilder().token(config.TELEGRAM_TOKEN).build()

    # Служебные команды. Проверка работ — только в мини-аппе (см. webapp.py).
    app.add_handler(CommandHandler("start", commands.start))
    app.add_handler(CommandHandler("help", commands.help_cmd))
    app.add_handler(CommandHandler("balance", commands.balance))
    app.add_handler(CommandHandler("history", commands.history_cmd))
    app.add_handler(CommandHandler("purchases", commands.purchases_cmd))
    app.add_handler(CommandHandler("buy", commands.buy))
    app.add_handler(CommandHandler("ref", commands.ref))
    # Кнопки тарифов из /buy → создание платежа ЮKassa.
    app.add_handler(CallbackQueryHandler(commands.buy_callback, pattern=r"^buy:"))
    # Кнопка «🧾 Мои покупки» (под /balance и сообщением об оплате).
    app.add_handler(CallbackQueryHandler(commands.purchases_cmd, pattern=r"^purchases$"))
    # Опрос-отзыв о проверке: кнопки (⭐, строгость, «Пропустить») и текстовые ответы.
    # Текст ловим в группе -1 раньше подсказки open_app_hint — только если опрос ждёт ответа.
    app.add_handler(CallbackQueryHandler(feedback.on_callback, pattern=r"^fb:"))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, feedback.on_text), group=-1)

    # Обычное сообщение (текст/фото) в чате — подсказываем открыть мини-аппу.
    app.add_handler(MessageHandler(filters.PHOTO, commands.open_app_hint))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, commands.open_app_hint))

    return app


async def main() -> None:
    app = build_application()
    async with app:
        # Веб-сервер мини-аппы и вебхука — в том же процессе и event loop, что и polling.
        # Запускаем после инициализации бота: вебхуку нужен app.bot, чтобы писать в Telegram.
        await run_web(app.bot)
        log.info("Бот запущен (long-polling + веб-сервер мини-аппы).")
        await app.start()
        await app.updater.start_polling()
        # Напоминания — фоновая задача в том же event loop. Ссылку держим, чтобы задачу не собрал GC.
        reminders_task = asyncio.create_task(reminders.run_loop(app.bot))  # noqa: F841
        # Страховка начислений: сами переспрашиваем ЮKassa, если вебхук не дошёл.
        payments_task = asyncio.create_task(payments.run_loop(app.bot))  # noqa: F841
        await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(main())
