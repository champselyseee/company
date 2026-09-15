"""Клавиатуры бота: кнопки мини-аппы и сайта, тарифы /buy и кнопка оплаты."""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

from . import config

try:  # общий каталог тарифов (как пакет core.* или одиночный модуль)
    from core import catalog
except ImportError:  # pragma: no cover
    import catalog  # type: ignore

BUY_PREFIX = "buy:"  # callback_data кнопок тарифов: «buy:<kind>:<id>»


def offers_keyboard() -> InlineKeyboardMarkup:
    """Кнопки всех тарифов из core/catalog.py для /buy."""
    rows = []
    for offer in catalog.all_offers():
        title = offer["title"][:1].upper() + offer["title"][1:]
        rows.append([InlineKeyboardButton(
            f"{title} — {offer['price']} ₽",
            callback_data=f"{BUY_PREFIX}{offer['kind']}:{offer['id']}",
        )])
    return InlineKeyboardMarkup(rows)


def pay_keyboard(url: str, price: int) -> InlineKeyboardMarkup:
    """Одна кнопка-ссылка на страницу оплаты ЮKassa."""
    return InlineKeyboardMarkup([[InlineKeyboardButton(f"💳 Оплатить {price} ₽", url=url)]])


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
