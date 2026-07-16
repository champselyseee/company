"""Клавиатуры бота. Выбор типа работы, кнопка «Проверить ещё» и кнопка открытия мини-аппы."""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

from . import config

# Порядок и подписи кнопок выбора типа. Ключи совпадают с core.claude.PROMPTS.
# callback_data кнопки — "type:<key>" (ловится в handlers/check.py).
WORK_TYPES = [
    ("email", "✉️ Письмо (англ., задание 37)"),
    ("essay", "📝 Эссе (англ., задание 38)"),
    ("composition", "📄 Сочинение (рус., задание 27)"),
]


def work_type_keyboard() -> InlineKeyboardMarkup:
    """Inline-клавиатура выбора типа работы."""
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton(label, callback_data=f"type:{key}")] for key, label in WORK_TYPES]
    )


def recheck_keyboard() -> InlineKeyboardMarkup:
    """Кнопка под результатом: начать новую проверку (снова выбрать тип работы)."""
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton("🔁 Проверить ещё", callback_data="recheck")]]
    )


def webapp_keyboard() -> InlineKeyboardMarkup | None:
    """Кнопка открытия мини-аппы. None, если WEBAPP_URL не задан (тогда кнопку не показываем)."""
    if not config.WEBAPP_URL:
        return None
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton("✍️ Открыть проверку", web_app=WebAppInfo(url=config.WEBAPP_URL))]]
    )
