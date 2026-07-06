"""Общий модуль распознавания рукописного текста (OCR) через Grok (xAI).

Третий общий скрипт из папки core/ (рядом с db.py и claude.py). Заточен ТОЛЬКО под одну
задачу: перевести рукописный текст с фотографии работы в печатный вид. И бот, и сайт зовут
его через свои бэкенды (фронт → бэкенд → core.grok), чтобы распознавание было одинаковым.

Почему отдельный модуль и почему Grok, а не Claude:
  • проверку работ делает Claude (core/claude.py), а распознавание рукописи мы отдали Grok;
  • Claude при этом по-прежнему принимает ФОТО ЗАДАНИЯ для проверки (photos в check_work) —
    сюда это не относится, тут только рукописный текст ученика.

xAI API OpenAI-совместимый, поэтому клиент — AsyncOpenAI с base_url xAI. Фото шлётся как
image_url с data-URL целиком (jpg/png, ≤20 МиБ).

Ключи и настройки берутся из переменных окружения:
    XAI_API_KEY     — ключ доступа к xAI/Grok (обязателен)
    GROK_MODEL      — модель распознавания (по умолчанию grok-4; в кабинете xAI уточни точный ID)
    GROK_BASE_URL   — адрес API xAI (по умолчанию https://api.x.ai/v1)
    GROK_MAX_TOKENS — лимит вывода для распознавания (по умолчанию 4000)
    REQUEST_TIMEOUT — таймаут запроса, сек (по умолчанию 600 — «на максимум»)
    AI_CONCURRENCY  — сколько запросов к Grok одновременно (по умолчанию 10)

CLI для быстрой проверки БЕЗ обращения к сети:
    python -m grok --selftest   # промпт/настройки на месте
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


XAI_API_KEY     = os.environ.get("XAI_API_KEY")
GROK_MODEL      = os.environ.get("GROK_MODEL", "grok-4")
GROK_BASE_URL   = os.environ.get("GROK_BASE_URL", "https://api.x.ai/v1")
GROK_MAX_TOKENS = int(os.environ.get("GROK_MAX_TOKENS", "4000"))
# «Таймаут на максимум»: долгое распознавание не обрывается раньше времени.
REQUEST_TIMEOUT = int(os.environ.get("REQUEST_TIMEOUT", "600"))
AI_CONCURRENCY  = int(os.environ.get("AI_CONCURRENCY", "10"))

log = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None
_semaphore: asyncio.Semaphore | None = None


class GrokError(Exception):
    """Ошибка при обращении к Grok — с понятным текстом для показа пользователю."""


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
        raise GrokError("Некорректное фото: ожидается data:image/...;base64,<данные>")


# Промпт распознавания перенесён из бота (backendmirrr) дословно.
OCR_PROMPT = """Ты — система оптического распознавания рукописного текста (OCR).
Твоя задача: точно перевести рукописный текст с фотографии в печатный вид.

ПРАВИЛА:
- Переводи ТОЛЬКО тот текст, который видишь на фото
- Не добавляй ничего от себя и не исправляй содержание
- Сохраняй структуру и абзацы как в оригинале
- Не исправляй орфографию и грамматику — переводи буква в букву
- Если слово неразборчиво — напиши наиболее вероятный вариант и добавь [?]
- Выведи ТОЛЬКО распознанный текст, без заголовков и комментариев"""


async def ocr(photo: str) -> str:
    """Распознаёт рукописный текст с фото (data:image/...;base64,...) → печатный текст.

    Единственная функция модуля. В базу ничего не пишет (распознавание — не проверка).
    Возвращает распознанный текст. При проблеме — GrokError.
    """
    _validate_photo(photo)
    try:
        async with _sem():
            resp = await client().chat.completions.create(
                model=GROK_MODEL,
                max_tokens=GROK_MAX_TOKENS,
                timeout=REQUEST_TIMEOUT,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": OCR_PROMPT},
                            # xAI/OpenAI принимают data-URL целиком в image_url.
                            {"type": "image_url", "image_url": {"url": photo}},
                        ],
                    }
                ],
            )
    except openai.APITimeoutError as e:
        raise GrokError("Таймаут распознавания") from e
    except openai.APIStatusError as e:
        raise GrokError(f"Ошибка распознавания: {str(e)[:200]}") from e
    except openai.APIError as e:  # прочие ошибки клиента/сети
        raise GrokError(f"Ошибка распознавания: {str(e)[:200]}") from e

    if not resp.choices:
        raise GrokError("Grok вернул пустой ответ")
    recognized = (resp.choices[0].message.content or "").strip()
    if not recognized:
        raise GrokError("Не удалось распознать текст на фото")
    return recognized


# ── CLI: быстрый самотест без обращения к сети ──

def _selftest() -> None:
    assert OCR_PROMPT.lstrip().startswith("Ты — система"), "OCR-промпт повреждён"
    assert "`" not in OCR_PROMPT, "в OCR-промпте случайный символ `"
    print("OK: OCR-промпт на месте")
    print(f"модель: {GROK_MODEL} | base_url: {GROK_BASE_URL} "
          f"| max_tokens: {GROK_MAX_TOKENS} | timeout: {REQUEST_TIMEOUT}s")


if __name__ == "__main__":
    import sys

    arg = sys.argv[1] if len(sys.argv) > 1 else "--help"
    if arg == "--selftest":
        _selftest()
    else:
        print("Использование: python -m grok [--selftest]")
