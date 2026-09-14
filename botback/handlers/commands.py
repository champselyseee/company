"""Команды бота: /start, /help, /balance, /history, /ref. Оплата (/buy) — пока заглушка.

Проверка работ — только через мини-аппу (см. botback/webapp.py). На любое обычное
сообщение в чате отвечаем подсказкой открыть приложение (open_app_hint).
Почти под каждым ответом — кнопки «Открыть проверку» и «Сайт», в тексте — адрес сайта.
"""

import asyncio
import json
import logging

from telegram import Update
from telegram.ext import ContextTypes

from .. import config
from ..formatting import WORK_TYPE_NAMES
from ..keyboards import main_keyboard

# Общая база из core/. Пробуем как пакет (core.db) и как одиночный модуль (db).
try:
    from core import db
except ImportError:
    import db

log = logging.getLogger(__name__)

# Реферальная ссылка: t.me/<бот>?start=ref_<telegram_id пригласившего> (формат старого бота —
# уже розданные ссылки продолжают работать).
REF_PREFIX = "ref_"


def _with_site(text: str, site_line: str) -> str:
    """Дописывает строку про сайт ({site} → адрес), если адрес сайта задан."""
    if not config.SITE_URL:
        return text
    return f"{text}\n\n{site_line.format(site=config.SITE_DOMAIN)}"


async def _link_referrer(referred_id: int, arg: str) -> None:
    """Записывает, кто пригласил. Сбой не должен ломать приветствие — только в лог."""
    try:
        referrer_tg = int(arg[len(REF_PREFIX):])
    except ValueError:
        return
    try:
        referrer = await asyncio.to_thread(db.get_user_by_telegram_id, referrer_tg)
        if referrer:  # незнакомый id в базу не заводим
            # set_referrer сам отсекает «пригласил сам себя» и повторную привязку.
            await asyncio.to_thread(db.set_referrer, referred_id, referrer["id"])
    except Exception:
        log.warning("Не удалось записать реферала (%s)", arg, exc_info=True)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """/start — приветствие, заведение пользователя в базе и привязка по реферальной ссылке."""
    user = update.effective_user
    # core.db синхронный (psycopg) — уводим в поток, чтобы не блокировать event loop.
    row = await asyncio.to_thread(db.get_or_create_telegram_user, user.id, user.username or None)
    # Привязываем только тех, кто ещё не пользовался проверкой (как в старом боте).
    if context.args and context.args[0].startswith(REF_PREFIX) and not row.get("free_used"):
        await _link_referrer(row["id"], context.args[0])
    text = (
        "👋 Привет! Я проверяю работы по критериям ЕГЭ: письмо (37) и эссе (38) "
        "по английскому и сочинение по русскому.\n\n"
        "🎁 Первая проверка — бесплатно.\n"
        "✍️ Проверить работу — кнопка ниже."
    )
    text = _with_site(text, "🌐 На сайте {site} — база аргументов для сочинения и история твоих разборов.")
    await update.message.reply_text(text, reply_markup=main_keyboard())


async def help_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """/help — краткая справка по командам."""
    text = (
        "✍️ Работы проверяю в приложении (кнопка ниже)\n"
        "/balance — сколько проверок осталось\n"
        "/history — последние проверки\n"
        "/ref — пригласить друга и получить бонус"
    )
    text = _with_site(text, "🌐 Материалы для подготовки: {site}")
    text += f"\n\nВопросы: {config.SUPPORT_CONTACT}"
    await update.message.reply_text(text, reply_markup=main_keyboard())


async def balance(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """/balance — сколько проверок доступно."""
    user = update.effective_user
    site_line = "🌐 На сайте {site} тот же баланс — войди через Telegram."
    if config.is_whitelisted(user.username or ""):
        await update.message.reply_text("👑 У тебя безлимитный доступ.", reply_markup=main_keyboard())
        return
    row = await asyncio.to_thread(db.get_or_create_telegram_user, user.id, user.username or None)
    if db.has_subscription(row):
        left = db.subscription_left(row)
        text = f"📅 Подписка активна: осталось {left} из {db.SUBSCRIPTION_MONTHLY_QUOTA} проверок в этом месяце."
    else:
        free_left = 0 if row.get("free_used") else 1
        paid = row.get("paid_checks", 0) or 0
        total = free_left + paid
        suffix = " (в т.ч. 1 бесплатная)" if free_left else ""
        text = f"📊 Проверок доступно: {total}{suffix}\n\nКупить ещё — /buy."
    await update.message.reply_text(_with_site(text, site_line), reply_markup=main_keyboard())


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
        await update.message.reply_text(
            "📭 У тебя ещё нет проверок. Первая — бесплатно, жми кнопку ниже 👇",
            reply_markup=main_keyboard(),
        )
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
    text = _with_site("\n".join(lines), "🌐 Полные разборы — на сайте {site} (войди через Telegram).")
    await update.message.reply_text(text, reply_markup=main_keyboard())


async def ref(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """/ref — личная реферальная ссылка и статистика приглашений."""
    user = update.effective_user
    row = await asyncio.to_thread(db.get_or_create_telegram_user, user.id, user.username or None)
    total, rewarded = await asyncio.to_thread(db.referral_stats, row["id"])
    link = f"https://t.me/{context.bot.username}?start={REF_PREFIX}{user.id}"
    await update.message.reply_text(
        f"👥 Твоя ссылка для друзей:\n{link}\n\n"
        "Когда друг по ней придёт и купит проверки — тебе начислим 1 проверку в подарок.\n\n"
        f"📊 Приглашено: {total}\n"
        f"🎁 Бонусов получено: {rewarded}"
    )


async def open_app_hint(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Любое обычное сообщение (текст/фото): проверка теперь только в мини-аппе."""
    text = _with_site(
        "✍️ Чтобы проверить работу, открой приложение кнопкой ниже 👇",
        "Или загляни на сайт: {site}",
    )
    await update.message.reply_text(text, reply_markup=main_keyboard())
