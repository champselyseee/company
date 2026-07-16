"""Точка входа бэкенда бота: сборка приложения PTB, регистрация хендлеров, запуск.

Бот работает по long-polling (без веб-сервера): веб-эндпоинты (OCR/проверка/вебхуки)
для сайта и мини-аппа обслуживает siteback, а бот зовёт общий core/ напрямую.

Запуск: python -m botback.main   (из корня репозитория, чтобы был виден пакет core/)
"""

import logging

from telegram.ext import (
    ApplicationBuilder,
    CallbackQueryHandler,
    CommandHandler,
    MessageHandler,
    filters,
)

from . import config
from .handlers import check, commands

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger(__name__)


def build_application():
    """Собирает приложение python-telegram-bot и регистрирует все хендлеры."""
    if not config.TELEGRAM_TOKEN:
        raise RuntimeError("TELEGRAM_TOKEN не задан (переменная окружения).")

    app = ApplicationBuilder().token(config.TELEGRAM_TOKEN).build()

    # Команды.
    app.add_handler(CommandHandler("start", commands.start))
    app.add_handler(CommandHandler("help", commands.help_cmd))
    app.add_handler(CommandHandler("balance", commands.balance))
    app.add_handler(CommandHandler("history", commands.history_cmd))
    app.add_handler(CommandHandler("buy", commands.buy))
    app.add_handler(CommandHandler("check", check.check_cmd))

    # Выбор типа работы (inline-кнопки "type:...") и кнопка «Проверить ещё».
    app.add_handler(CallbackQueryHandler(check.pick_type, pattern=r"^type:"))
    app.add_handler(CallbackQueryHandler(check.recheck, pattern=r"^recheck$"))

    # Любое фото или обычный текст (не команда) — это работа на проверку.
    app.add_handler(MessageHandler(filters.PHOTO, check.on_work))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, check.on_work))

    return app


def main() -> None:
    app = build_application()
    log.info("Бот запущен (long-polling).")
    app.run_polling()


if __name__ == "__main__":
    main()
