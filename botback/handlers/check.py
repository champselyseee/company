"""Проверка работы: /check (выбор типа) → приём текста или фото → разбор через Grok.

Простой сценарий для чата (без мини-аппа):
  1) /check — показываем кнопки выбора типа работы;
  2) выбранный тип запоминаем в context.user_data['work_type'];
  3) СЛЕДУЮЩЕЕ сообщение (текст или фото) считаем самой работой и проверяем его;
     выбор типа «одноразовый» — сразу после него он гасится, чтобы обычные
     сообщения в чате не запускали проверку и не списывали баланс.
     Фото рукописи сперва распознаём (OCR через core.grok), затем проверяем через
     core.grok_check и отвечаем кратким разбором с кнопкой «Проверить ещё».
Доступ (бесплатная/оплаченные/подписка) списываем через core.db.consume_check.
"""

import asyncio
import base64
import logging

from telegram import Update
from telegram.ext import ContextTypes

from .. import config
from ..formatting import format_result
from ..keyboards import WORK_TYPES, recheck_keyboard, work_type_keyboard

# Общий core/: база, OCR (grok) и проверка работ (grok_check).
try:
    from core import db, grok, grok_check
except ImportError:
    import db, grok, grok_check

log = logging.getLogger(__name__)

WORK_TYPE_LABELS = dict(WORK_TYPES)


async def check_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """/check — предложить выбрать тип работы."""
    await update.message.reply_text(
        "Что проверяем? Выбери тип работы:",
        reply_markup=work_type_keyboard(),
    )


async def pick_type(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Нажата кнопка выбора типа (callback_data 'type:<key>')."""
    query = update.callback_query
    await query.answer()
    key = query.data.split(":", 1)[1]
    if key not in WORK_TYPE_LABELS:
        await query.edit_message_text("Неизвестный тип работы. Нажми /check ещё раз.")
        return
    context.user_data["work_type"] = key
    await query.edit_message_text(
        f"Тип: {WORK_TYPE_LABELS[key]}.\n\n"
        "Теперь пришли текст работы одним сообщением или фото рукописи 👇"
    )


async def recheck(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Кнопка «Проверить ещё» под результатом — снова показываем выбор типа работы."""
    query = update.callback_query
    await query.answer()
    await query.message.reply_text(
        "Что проверяем? Выбери тип работы:",
        reply_markup=work_type_keyboard(),
    )


async def _photo_to_data_url(update: Update, context: ContextTypes.DEFAULT_TYPE) -> str:
    """Скачивает самое крупное фото сообщения и кодирует в data:image/jpeg;base64,..."""
    photo = update.message.photo[-1]  # последний размер — самое большое разрешение
    tg_file = await context.bot.get_file(photo.file_id)
    buf = await tg_file.download_as_bytearray()
    b64 = base64.b64encode(bytes(buf)).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


async def on_work(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Пришёл текст или фото — если тип выбран, проверяем работу (выбор одноразовый)."""
    # «Одноразовый» тип: забираем и сразу гасим. Так проверка запускается ровно на
    # ОДНО сообщение после выбора типа, а обычные сообщения в чате её не триггерят
    # и не списывают баланс.
    work_type = context.user_data.pop("work_type", None)
    if not work_type:
        await update.message.reply_text("Сначала выбери тип работы — нажми /check.")
        return

    user = update.effective_user
    username = user.username or ""
    # core.db синхронный (psycopg) — уводим в поток, чтобы не блокировать event loop.
    row = await asyncio.to_thread(db.get_or_create_telegram_user, user.id, username or None)
    user_id = row["id"]

    # Доступ: whitelist — безлимит (ничего не списываем); иначе списываем одну проверку.
    if config.is_whitelisted(username):
        kind = None
    else:
        kind = await asyncio.to_thread(db.consume_check, user_id)
        if kind is None:
            await update.message.reply_text("🔒 Проверки закончились. Пополнить баланс — /buy.")
            return

    status = await update.message.reply_text("⏳ Проверяю работу…")

    try:
        # Фото рукописи → сперва распознаём (OCR через core.grok), потом проверяем.
        if update.message.photo:
            await status.edit_text("🔎 Распознаю рукопись…")
            data_url = await _photo_to_data_url(update, context)
            text = await grok.ocr(data_url)
            await status.edit_text("⏳ Проверяю работу…")
        else:
            text = update.message.text or ""

        result_json = await grok_check.check_work(user_id, work_type, text=text, source="bot")
    except Exception as exc:
        # ИИ не ответил — возвращаем списанную проверку, чтобы юзер её не потерял.
        if kind:
            await asyncio.to_thread(db.refund_check, user_id, kind)
        log.exception("Проверка не удалась (user_id=%s, type=%s)", user_id, work_type)
        await status.edit_text(
            f"⚠️ Не получилось проверить: {str(exc)[:200]}\nПопробуй ещё раз.",
            reply_markup=recheck_keyboard(),
        )
        return

    await status.edit_text(format_result(work_type, result_json), reply_markup=recheck_keyboard())
