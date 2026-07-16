"""Команды бота: /start, /help, /balance, /history. Оплата (/buy) — пока заглушка."""

import asyncio
import json
import logging

from telegram import Update
from telegram.ext import ContextTypes

from .. import config
from ..formatting import WORK_TYPE_NAMES
from ..keyboards import webapp_keyboard

# Общая база из core/. Пробуем как пакет (core.db) и как одиночный модуль (db).
try:
    from core import db
except ImportError:
    import db

log = logging.getLogger(__name__)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """/start — приветствие и заведение пользователя в базе."""
    user = update.effective_user
    # core.db синхронный (psycopg) — уводим в поток, чтобы не блокировать event loop.
    await asyncio.to_thread(db.get_or_create_telegram_user, user.id, user.username or None)
    await update.message.reply_text(
        "👋 Привет! Я проверю твою работу по критериям ЕГЭ "
        "(письмо и эссе по английскому или сочинение по русскому).\n\n"
        "Первая проверка — бесплатно.\n\n"
        "Открой приложение кнопкой ниже 👇 или нажми /check прямо в чате "
        "и пришли текст или фото рукописи.",
        reply_markup=webapp_keyboard(),
    )


async def help_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """/help — краткая справка по командам."""
    await update.message.reply_text(
        "Я проверяю работы по критериям ЕГЭ.\n\n"
        "• /check — выбрать тип и прислать работу (текст или фото)\n"
        "• /balance — сколько проверок осталось\n"
        "• /history — последние проверки\n\n"
        f"Вопросы: {config.SUPPORT_CONTACT}"
    )


async def balance(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """/balance — сколько проверок доступно."""
    user = update.effective_user
    if config.is_whitelisted(user.username or ""):
        await update.message.reply_text("👑 У тебя безлимитный доступ.")
        return
    row = await asyncio.to_thread(db.get_or_create_telegram_user, user.id, user.username or None)
    if db.has_subscription(row):
        await update.message.reply_text("📅 У тебя активна подписка (безлимит).")
        return
    free_left = 0 if row.get("free_used") else 1
    paid = row.get("paid_checks", 0) or 0
    total = free_left + paid
    suffix = " (в т.ч. 1 бесплатная)" if free_left else ""
    await update.message.reply_text(
        f"📊 Проверок доступно: {total}{suffix}\n\nКупить ещё — /buy."
    )


async def buy(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """/buy — оплата (заглушка на этом этапе; подключим следующим шагом)."""
    await update.message.reply_text(
        "💳 Оплата скоро появится. Пока по вопросам доступа пиши "
        f"{config.SUPPORT_CONTACT}."
    )


async def history_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """/history — последние 5 проверок пользователя."""
    user = update.effective_user
    row = await asyncio.to_thread(db.get_or_create_telegram_user, user.id, user.username or None)
    rows = await asyncio.to_thread(db.get_history, row["id"], 5)
    if not rows:
        await update.message.reply_text("📭 У тебя ещё нет проверок.")
        return
    lines = ["📋 Последние проверки:", ""]
    for i, item in enumerate(rows, 1):
        name = WORK_TYPE_NAMES.get(item["work_type"], item["work_type"])
        created = item.get("created_at")
        when = created.strftime("%d.%m %H:%M") if created else ""
        preview = ""
        try:
            data = json.loads(item["result"])
            if isinstance(data, dict) and "score" in data and "max_score" in data:
                preview = f"Балл: {data['score']}/{data['max_score']}"
        except (ValueError, TypeError):
            pass
        lines.append(f"{i}. {name} — {when}\n{preview}".rstrip())
    await update.message.reply_text("\n".join(lines))
