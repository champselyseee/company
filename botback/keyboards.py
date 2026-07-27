"""Клавиатуры бота: кнопка открытия мини-аппы."""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

from . import config


def webapp_keyboard() -> InlineKeyboardMarkup | None:
    """Кнопка открытия мини-аппы. None, если WEBAPP_URL не задан (тогда кнопку не показываем)."""
    if not config.WEBAPP_URL:
        return None
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton("✍️ Открыть проверку", web_app=WebAppInfo(url=config.WEBAPP_URL))]]
    )
