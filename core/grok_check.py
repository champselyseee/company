"""Проверка работ ЕГЭ через Grok (xAI) — общий модуль core/, который зовёт ТОЛЬКО бот.

Четвёртый общий скрипт в core/ (рядом с db.py, claude.py, grok.py). Отвечает за ОДНО:
проверить работу ученика и вернуть разбор строгим JSON — тем же форматом, что и
core/claude.py (сайт), чтобы результат бота и сайта был одинаковым. Отличие — движок:
здесь xAI/Grok (OpenAI-совместимый API), а не Anthropic.

Промпты по типам работ и JSON-схема ответа НЕ дублируются — берём их из core/claude.py
(единый источник правды). Так проверка на боте и на сайте гарантированно совпадает; когда
всё сведём «на один кор», достаточно будет менять промпты в одном месте.

После успешной проверки сам пишет её в общую базу (core/db.py): строка в истории +
«+1» к counters.total_checks — одной транзакцией через db.record_check().

Переменные окружения (клиент xAI — тот же, что в core/grok.py):
    XAI_API_KEY           — ключ доступа к xAI/Grok (обязателен; новый ключ под проверку)
    GROK_CHECK_MODEL      — модель проверки (по умолчанию grok-4)
    GROK_BASE_URL         — адрес API xAI (по умолчанию https://api.x.ai/v1)
    GROK_CHECK_MAX_TOKENS — лимит вывода проверки (по умолчанию 16000)
    REQUEST_TIMEOUT       — таймаут запроса, сек (по умолчанию 600 — «на максимум»)
    AI_CONCURRENCY        — одновременных запросов к Grok (по умолчанию 10)

CLI для быстрой проверки БЕЗ обращения к сети:
    python -m core.grok_check --selftest   # промпты/схема на месте, настройки видны
"""

import asyncio
import logging
import os

import openai
from openai import AsyncOpenAI

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:  # чтобы --selftest работал даже без установленных пакетов
    pass

# Промпты по типам работ и JSON-схема ответа — единый источник в core/claude.py
# (не дублируем: проверка бота и сайта должна совпадать). Пробуем и как пакет
# (core.claude), и как одиночный модуль (claude) — чтобы работало из обоих запусков.
try:
    from .claude import PROMPTS, RESULT_SCHEMA
except ImportError:
    from claude import PROMPTS, RESULT_SCHEMA


XAI_API_KEY     = os.environ.get("XAI_API_KEY")
GROK_MODEL      = os.environ.get("GROK_CHECK_MODEL", os.environ.get("GROK_MODEL", "grok-4"))
GROK_BASE_URL   = os.environ.get("GROK_BASE_URL", "https://api.x.ai/v1")
MAX_TOKENS      = int(os.environ.get("GROK_CHECK_MAX_TOKENS", "16000"))
# «Таймаут на максимум»: длинная проверка не обрывается раньше времени.
REQUEST_TIMEOUT = int(os.environ.get("REQUEST_TIMEOUT", "600"))
AI_CONCURRENCY  = int(os.environ.get("AI_CONCURRENCY", "10"))
MAX_INPUT_CHARS = 60000  # длиннее — текст работы обрезаем (как в claude.py)

log = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None
_semaphore: asyncio.Semaphore | None = None


class GrokCheckError(Exception):
    """Ошибка проверки работы через Grok — с понятным текстом для показа пользователю."""


def client() -> AsyncOpenAI:
    """Ленивое создание единого асинхронного клиента xAI (OpenAI-совместимый API)."""
    global _client
    if _client is None:
        if not XAI_API_KEY:
            raise RuntimeError(
                "XAI_API_KEY не задан. Укажи ключ доступа к xAI/Grok "
                "(в Railway — переменной окружения; локально — в .env)."
            )
        _client = AsyncOpenAI(api_key=XAI_API_KEY, base_url=GROK_BASE_URL, max_retries=3)
    return _client


def _sem() -> asyncio.Semaphore:
    """Ленивый семафор: не даём улететь больше AI_CONCURRENCY запросов разом."""
    global _semaphore
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(AI_CONCURRENCY)
    return _semaphore


def _validate_photo(photo) -> None:
    """Проверяет, что фото — корректный data-URL (data:image/...;base64,<данные>)."""
    if not isinstance(photo, str) or not photo.startswith("data:image/") or "," not in photo:
        raise GrokCheckError("Некорректное фото: ожидается data:image/...;base64,<данные>")


def _build_user_content(prompt: str, combined_text: str, photos):
    """content для xAI/OpenAI: с фото — картинки (image_url с data-URL) + текст, иначе только текст."""
    if photos:
        content = [{"type": "image_url", "image_url": {"url": p}} for p in photos]
        content.append({
            "type": "text",
            "text": "Вот фото/файл задания и текст работы.\n\n" + prompt + combined_text,
        })
        return content
    return [{"type": "text", "text": prompt + combined_text}]


async def check_work(
    user_id: int,
    work_type: str,
    text: str = "",
    *,
    photos: list[str] | None = None,
    file_name: str | None = None,
    file_text: str | None = None,
    source: str = "bot",
    record: bool = True,
) -> str:
    """Проверяет работу через Grok и (по умолчанию) записывает её в общую базу.

    Интерфейс совпадает с core.claude.check_work: caller передаёт ВНУТРЕННИЙ users.id
    (не telegram_id), work_type — ключ PROMPTS ('email' | 'essay' | 'composition').

    После успешного ответа зовёт db.record_check(...), которая ОДНОЙ транзакцией пишет
    строку в историю и +1 к публичному счётчику counters.total_checks.

    Возвращает строку-ответ (JSON по RESULT_SCHEMA). При проблеме — GrokCheckError.
    """
    prompt = PROMPTS.get(work_type)
    if prompt is None:
        raise GrokCheckError(f"Неизвестный тип работы: {work_type!r}")

    combined_text = text or ""
    if file_text:
        combined_text += f"\n\n--- Текст из файла: {file_name or 'файл'} ---\n{file_text}"
    if not combined_text.strip() and not photos:
        raise GrokCheckError("Пустая работа: нет ни текста, ни фото.")
    for _photo in photos or []:
        _validate_photo(_photo)
    if len(combined_text) > MAX_INPUT_CHARS:
        combined_text = combined_text[:MAX_INPUT_CHARS] + "\n\n[Текст был обрезан до 60000 символов.]"

    def _create_kwargs(with_format: bool) -> dict:
        kwargs = {
            "model": GROK_MODEL,
            "max_tokens": MAX_TOKENS,
            "timeout": REQUEST_TIMEOUT,
            "messages": [
                {
                    "role": "system",
                    "content": "Ты опытный преподаватель, проверяющий работы по ЕГЭ. "
                               "Отвечай строго в формате JSON по описанной схеме.",
                },
                {"role": "user", "content": _build_user_content(prompt, combined_text, photos)},
            ],
        }
        if with_format:
            # JSON-режим: модель обязана вернуть валидный JSON. Саму схему подробно
            # диктует FORMAT_BLOCK внутри промпта (он уже вклеен в каждый промпт claude.py).
            kwargs["response_format"] = {"type": "json_object"}
        return kwargs

    try:
        async with _sem():
            try:
                resp = await client().chat.completions.create(**_create_kwargs(True))
            except openai.APIStatusError as e:
                # Некоторые модели/версии xAI могут не принимать параметр response_format.
                # Тогда повторяем запрос без него — строгий JSON всё равно задан в промпте
                # (FORMAT_BLOCK), поэтому формат ответа не теряется.
                if getattr(e, "status_code", None) in (400, 404, 422):
                    log.warning("Grok отклонил response_format (%s) — повтор без него", e.status_code)
                    resp = await client().chat.completions.create(**_create_kwargs(False))
                else:
                    raise
    except openai.APITimeoutError as e:
        raise GrokCheckError("Таймаут ответа от ИИ") from e
    except openai.APIStatusError as e:
        raise GrokCheckError(f"Ошибка проверки (Grok): {str(e)[:200]}") from e
    except openai.APIError as e:  # прочие ошибки клиента/сети
        raise GrokCheckError(f"Ошибка проверки (Grok): {str(e)[:200]}") from e

    if not resp.choices:
        raise GrokCheckError("Grok вернул пустой ответ")
    answer = (resp.choices[0].message.content or "").strip()
    if not answer:
        raise GrokCheckError("ИИ вернул пустой ответ")

    if record:
        # Ленивый импорт общей базы: чтобы --selftest не требовал psycopg.
        try:
            from . import db
        except ImportError:
            import db
        try:
            # record_check синхронный (psycopg) — уводим в поток, чтобы не блокировать loop.
            await asyncio.to_thread(db.record_check, user_id, work_type, answer, source=source)
        except Exception:
            # База временно недоступна — НЕ теряем уже полученный (дорогой) ответ:
            # логируем и всё равно возвращаем результат пользователю.
            log.exception(
                "Не удалось записать проверку в базу (user_id=%s, type=%s)",
                user_id, work_type,
            )

    return answer


# ── CLI: быстрый самотест без обращения к сети ──

def _selftest() -> None:
    assert set(PROMPTS) == {"email", "essay", "composition"}, "нет промптов по типам работ"
    assert RESULT_SCHEMA.get("required"), "схема ответа повреждена"
    for _k, _p in PROMPTS.items():
        assert "ФОРМАТ ОТВЕТА" in _p, f"в промпте {_k} нет блока формата ответа"
    print("OK: промпты и схема на месте (общие с core/claude.py)")
    print(f"модель: {GROK_MODEL} | base_url: {GROK_BASE_URL} "
          f"| max_tokens: {MAX_TOKENS} | timeout: {REQUEST_TIMEOUT}s")


if __name__ == "__main__":
    import sys

    arg = sys.argv[1] if len(sys.argv) > 1 else "--help"
    if arg == "--selftest":
        _selftest()
    else:
        print("Использование: python -m core.grok_check [--selftest]")
