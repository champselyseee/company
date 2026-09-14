"""Клавиатуры бота: кнопки мини-аппы и сайта."""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

from . import config


def main_keyboard() -> InlineKeyboardMarkup | None:
    """Кнопки под сообщениями бота: открыть проверку (мини-аппа) и перейти на сайт.

    Кнопку показываем, только если задан её адрес (WEBAPP_URL / SITE_URL).
    None — если не задан ни один (тогда сообщение уходит без кнопок).
    """
    rows = []
    if config.WEBAPP_URL:
        rows.append(
            [InlineKeyboardButton("✍️ Открыть проверку", web_app=WebAppInfo(url=config.WEBAPP_URL))]
        )
    if config.SITE_URL:
        rows.append([InlineKeyboardButton("🌐 Сайт Expert ЕГЭ", url=config.SITE_URL)])
    return InlineKeyboardMarkup(rows) if rows else None
