"""Опрос-отзыв о проверке в чате бота — те же 4 вопроса, что в анкете на сайте.

После 1-й и каждой 5-й проверки в мини-аппе (webapp.handle_check → send_poll) бот тихо
присылает в чат сообщение с опросом. Дальше по шагам, кнопками:
  1/4 удовлетворённость проверкой — ⭐1…⭐5;
  2/4 где модель была слишком строга/простительна — 3 кнопки (+ «где именно» сообщением);
  3/4 удобство такого формата — ⭐1…⭐5 → здесь отзыв уже сохраняется в feedback;
  4/4 чего не хватает — сообщением или «Пропустить» → дописываем в тот же отзыв.

Оценки едут в callback_data самих кнопок (а не только в памяти бота) — опрос переживает
перезапуск бота; тексты ждём через context.user_data. Сохранение — core/db.save_feedback
(одна анкета на проверку, повтор обновляет), source='bot'.
"""

from __future__ import annotations

import asyncio
import logging

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ApplicationHandlerStop, ContextTypes

try:  # как пакет (core.db) или как одиночный модуль
    from core import db
except ImportError:  # pragma: no cover
    import db  # type: ignore

log = logging.getLogger(__name__)

PREFIX = "fb:"
ASK_EVERY = 5  # опрос после 1-й и каждой 5-й проверки в боте (как анкета на сайте)

STRICTNESS = {"ts": "too_strict", "jr": "just_right", "tl": "too_lenient"}
STRICTNESS_LABELS = {"ts": "Слишком строго", "jr": "В самый раз", "tl": "Слишком мягко"}

HEAD = "📝 Как вам проверка? · {step}/4\n\n"
Q1 = "Оцените свою удовлетворённость проверкой"
Q2 = "Где модель была слишком строга или простительна?"
Q2_NOTE = "Напишите сообщением, где именно (например: «занизили К2 за аргументы»)."
Q3 = "Оцените удобство такого формата проверки работ"
Q4 = "Чего не хватает? Напишите сообщением."
DONE = "✅ Спасибо за отзыв! Он помогает делать проверку точнее."
LATER = "Хорошо, не будем отвлекать 🙌"


def should_ask(bot_checks: int) -> bool:
    """bot_checks — сколько проверок у человека в боте (включая только что сделанную)."""
    return bot_checks == 1 or bot_checks % ASK_EVERY == 0


# ── Клавиатуры (в callback_data — номер проверки и уже данные ответы) ──

def _stars(prefix: str) -> list[list[InlineKeyboardButton]]:
    return [[InlineKeyboardButton(f"⭐{n}", callback_data=f"{prefix}:{n}") for n in range(1, 6)]]


def _q1_keyboard(hid: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        _stars(f"{PREFIX}s:{hid}") + [[InlineKeyboardButton("Не сейчас", callback_data=f"{PREFIX}x:{hid}")]]
    )


def _q2_keyboard(hid: int, sat: int) -> InlineKeyboardMarkup:
    b = lambda code: InlineKeyboardButton(STRICTNESS_LABELS[code], callback_data=f"{PREFIX}t:{hid}:{sat}:{code}")  # noqa: E731
    return InlineKeyboardMarkup([[b("ts"), b("jr")], [b("tl")]])


def _skip_note_keyboard(hid: int, sat: int, code: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[InlineKeyboardButton("Пропустить", callback_data=f"{PREFIX}n:{hid}:{sat}:{code}")]])


def _q3_keyboard(hid: int, sat: int, code: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(_stars(f"{PREFIX}c:{hid}:{sat}:{code}"))


def _skip_missing_keyboard(hid: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[InlineKeyboardButton("Пропустить", callback_data=f"{PREFIX}m:{hid}")]])


def _q3_text(sat: int, code: str) -> str:
    recap = f"Удовлетворённость: ⭐{sat} · {STRICTNESS_LABELS.get(code, '—')}"
    return HEAD.format(step=3) + f"{recap}\n\n{Q3}"


# ── Отправка опроса (из webapp после проверки) ──

async def send_poll(bot, chat_id: int, history_id: int) -> None:
    """Первое сообщение опроса — тихо (без звука), пока человек читает разбор в мини-аппе."""
    if bot is None:
        return
    try:
        await bot.send_message(
            chat_id=chat_id,
            text=HEAD.format(step=1) + Q1,
            reply_markup=_q1_keyboard(history_id),
            disable_notification=True,
        )
    except Exception:
        log.warning("Опрос: не удалось отправить (chat_id=%s)", chat_id, exc_info=True)


# ── Сохранение ──

async def _save(update: Update, hid: int, state: dict) -> bool:
    user = update.effective_user
    row = await asyncio.to_thread(db.get_or_create_telegram_user, user.id, user.username or None)
    try:
        return await asyncio.to_thread(
            db.save_feedback, row["id"], hid,
            satisfaction=state["sat"],
            convenience=state["conv"],
            strictness=STRICTNESS.get(state.get("code") or ""),
            strictness_note=state.get("strict_note"),
            missing_note=state.get("missing"),
            source="bot",
        )
    except Exception:
        log.exception("Опрос: не удалось сохранить отзыв (history_id=%s)", hid)
        return False


def _state(context: ContextTypes.DEFAULT_TYPE, hid: int) -> dict:
    """Состояние опроса по проверке hid (новая проверка — новое состояние)."""
    st = context.user_data.get("fb")
    if not st or st.get("hid") != hid:
        st = {"hid": hid}
        context.user_data["fb"] = st
    return st


# ── Кнопки опроса ──

async def on_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    parts = (query.data or "")[len(PREFIX):].split(":")
    try:
        action, hid = parts[0], int(parts[1])
        nums = [int(x) for x in parts[2:] if x.isdigit()]
    except (IndexError, ValueError):
        return
    st = _state(context, hid)

    if action == "x":  # «Не сейчас»
        context.user_data.pop("fb", None)
        await query.edit_message_text(LATER)
    elif action == "s":  # 1/4 → удовлетворённость
        st["sat"] = nums[-1]
        await query.edit_message_text(
            HEAD.format(step=2) + f"Удовлетворённость: ⭐{st['sat']}\n\n{Q2}",
            reply_markup=_q2_keyboard(hid, st["sat"]),
        )
    elif action == "t":  # 2/4 → строгость
        st["sat"], st["code"] = nums[0], parts[3]
        if st["code"] in ("ts", "tl"):  # «слишком …» — просим уточнить, где именно
            st["await"] = "strict_note"
            st["msg"] = (query.message.chat_id, query.message.message_id)
            await query.edit_message_text(
                HEAD.format(step=2) + f"{STRICTNESS_LABELS[st['code']]}.\n\n{Q2_NOTE}",
                reply_markup=_skip_note_keyboard(hid, st["sat"], st["code"]),
            )
        else:
            await query.edit_message_text(_q3_text(st["sat"], st["code"]), reply_markup=_q3_keyboard(hid, st["sat"], st["code"]))
    elif action == "n":  # «Пропустить» уточнение строгости
        st["sat"], st["code"], st["await"] = nums[0], parts[3], None
        await query.edit_message_text(_q3_text(st["sat"], st["code"]), reply_markup=_q3_keyboard(hid, st["sat"], st["code"]))
    elif action == "c":  # 3/4 → удобство: отзыв уже можно сохранить
        st["sat"], st["code"], st["conv"] = nums[0], parts[3], nums[-1]
        await _save(update, hid, st)
        st["await"] = "missing"
        st["msg"] = (query.message.chat_id, query.message.message_id)
        await query.edit_message_text(
            HEAD.format(step=4) + f"Удобство: ⭐{st['conv']}\n\n{Q4}",
            reply_markup=_skip_missing_keyboard(hid),
        )
    elif action == "m":  # «Пропустить» последний вопрос — отзыв уже сохранён на 3/4
        context.user_data.pop("fb", None)
        await query.edit_message_text(DONE)


# ── Текстовые ответы («где именно», «чего не хватает») ──

async def on_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Ловит текст, если опрос ждёт ответа сообщением; иначе пропускает к обычным хендлерам.

    Зарегистрирован в группе -1: если текст наш — ApplicationHandlerStop, чтобы бот не ответил
    ещё и подсказкой «открой приложение» (open_app_hint).
    """
    st = context.user_data.get("fb")
    if not st or not st.get("await"):
        return
    text = (update.message.text or "").strip()[:2000]
    if not text:
        return
    # У прошлого сообщения опроса убираем кнопку «Пропустить» — вопрос уже отвечен.
    chat_id, message_id = st.get("msg", (None, None))
    if chat_id:
        try:
            await context.bot.edit_message_reply_markup(chat_id=chat_id, message_id=message_id, reply_markup=None)
        except Exception:
            pass
    hid = st["hid"]
    if st["await"] == "strict_note":
        st["strict_note"], st["await"] = text, None
        await update.message.reply_text(_q3_text(st["sat"], st["code"]), reply_markup=_q3_keyboard(hid, st["sat"], st["code"]))
    elif st["await"] == "missing":
        st["missing"] = text
        await _save(update, hid, st)
        context.user_data.pop("fb", None)
        await update.message.reply_text(DONE)
    raise ApplicationHandlerStop
