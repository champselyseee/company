"""Форматирование JSON-разбора (core.claude.RESULT_SCHEMA) в читаемое сообщение Telegram.

В чате нет богатого рендера подсветки, как в мини-аппе, поэтому JSON-ответ модели
превращаем в короткий текст: итоговый балл, баллы по критериям и резюме.
"""

import json

# Человекочитаемые названия типов работ (для истории и заголовка результата).
WORK_TYPE_NAMES = {
    "email": "Письмо (37)",
    "essay": "Эссе (38)",
    "composition": "Сочинение (рус.)",
}

# Лимит одного сообщения Telegram — 4096 символов; берём с запасом.
_TELEGRAM_LIMIT = 4000


def format_result(work_type: str, result_json: str) -> str:
    """JSON-ответ проверки → текст для Telegram. Если это не JSON — отдаём как есть (обрезав)."""
    try:
        data = json.loads(result_json)
    except (ValueError, TypeError):
        return result_json[:_TELEGRAM_LIMIT]

    if not isinstance(data, dict):
        return result_json[:_TELEGRAM_LIMIT]

    name = WORK_TYPE_NAMES.get(work_type, work_type)
    lines = [f"✅ Проверка: {name}", ""]

    if "score" in data and "max_score" in data:
        lines.append(f"🏆 Итог: {data['score']}/{data['max_score']}")
        lines.append("")

    for crit in data.get("criteria", []):
        if not isinstance(crit, dict):
            continue
        code = crit.get("code", "")
        score = crit.get("score", "")
        maximum = crit.get("max", "")
        comment = crit.get("comment", "")
        lines.append(f"• {code}: {score}/{maximum} — {comment}")

    summary = data.get("summary")
    if summary:
        lines.append("")
        lines.append(f"💬 {summary}")

    return "\n".join(lines)[:_TELEGRAM_LIMIT]
