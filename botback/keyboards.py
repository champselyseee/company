"""Клавиатуры бота. Пока одна — выбор типа работы для проверки."""

from telegram import InlineKeyboardButton, InlineKeyboardMarkup

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
