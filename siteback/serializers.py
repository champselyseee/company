"""Сборка ответов в тех формах, которые ждёт фронт (sitefront/src/lib/api/types.ts).

Здесь база (строки таблиц) превращается в JSON-объекты с точными именами полей
(camelCase, как в TypeScript-типах фронта): User, HistoryItem, ProfileStats и т.д.
"""

from __future__ import annotations


import json
from datetime import date, datetime, timezone

from . import catalog

try:
    from core import db
except ImportError:  # pragma: no cover
    import db  # type: ignore

FREE_PLAN = "Бесплатный"


# ── Пользователь и баланс ──

def compute_balance(user: dict) -> int:
    """Сколько проверок доступно прямо сейчас: оплаченные + бесплатная (если не потрачена)."""
    free = 0 if user.get("free_used") else 1
    return int(user.get("paid_checks") or 0) + free


def plan_name(user: dict) -> str:
    """Название тарифа для показа. Есть активная подписка — «Подписка», иначе «Бесплатный»."""
    return "Подписка" if db.has_subscription(user) else FREE_PLAN


def _iso(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return str(value)


def user_public(user: dict) -> dict:
    """Пользователь в форме фронта (тип User)."""
    return {
        "id": user["id"],
        "displayName": user.get("display_name") or user.get("username"),
        "email": user.get("email"),
        "plan": plan_name(user),
        "balance": compute_balance(user),
        "joinedAt": _iso(user.get("created_at")),
    }


# ── Разбор проверки и история ──

def parse_result(result_str: str) -> dict:
    """core.claude.check_work возвращает JSON-строку по RESULT_SCHEMA — разбираем в объект."""
    try:
        return json.loads(result_str)
    except (json.JSONDecodeError, TypeError):
        # На всякий случай: если в базе не JSON — отдаём пустой безопасный разбор.
        return {"score": 0, "max_score": 0, "segments": [], "criteria": [], "summary": result_str or ""}


def _score_max(parsed: dict, work_type: str) -> tuple[int, int]:
    score = int(parsed.get("score") or 0)
    max_score = int(parsed.get("max_score") or 0)
    return score, max_score


def history_item(row: dict) -> dict:
    """Строка history -> HistoryItem фронта (id, workType, title, score, maxScore, createdAt)."""
    work_type = row["work_type"]
    parsed = parse_result(row["result"])
    score, max_score = _score_max(parsed, work_type)
    return {
        "id": row["id"],
        "workType": work_type,
        "title": catalog.WORK_TYPE_TITLES.get(work_type, work_type),
        "score": score,
        "maxScore": max_score,
        "createdAt": _iso(row["created_at"]),
    }


# ── Статистика профиля и достижения ──

def _percent(score: int, max_score: int) -> float | None:
    if max_score <= 0:
        return None
    return score / max_score * 100


def _streak_days(dates: list[date]) -> int:
    """Серия дней подряд с проверками, считая от самого свежего дня назад."""
    if not dates:
        return 0
    unique = sorted(set(dates), reverse=True)
    streak = 1
    cur = unique[0]
    for d in unique[1:]:
        if (cur - d).days == 1:
            streak += 1
            cur = d
        else:
            break
    return streak


def profile_payload(rows: list[dict]) -> dict:
    """ProfileResponse: статистика + id разблокированных достижений — из истории проверок."""
    works_checked = len(rows)
    percents: list[float] = []
    best: tuple[int, int] | None = None
    days: list[date] = []

    for row in rows:
        parsed = parse_result(row["result"])
        score, max_score = _score_max(parsed, row["work_type"])
        p = _percent(score, max_score)
        if p is not None:
            percents.append(p)
            if best is None or p > _percent(best[0], best[1]):
                best = (score, max_score)
        created = row.get("created_at")
        if isinstance(created, datetime):
            days.append(created.astimezone(timezone.utc).date())

    average_percent = round(sum(percents) / len(percents)) if percents else None
    best_score = f"{best[0]}/{best[1]}" if best else None
    streak = _streak_days(days)

    stats = {
        "worksChecked": works_checked,
        "averagePercent": average_percent,
        "streakDays": streak,
        "bestScore": best_score,
    }

    unlocked: list[str] = []
    if works_checked >= 1:
        unlocked.append("a1")                       # Первый шаг
    if streak >= 10:
        unlocked.append("a2")                       # На потоке — 10 дней
    if any(p >= 90 for p in percents):
        unlocked.append("a3")                       # Отличник — 90%+
    if works_checked >= 100:
        unlocked.append("a4")                       # Марафонец — 100 проверок

    return {"stats": stats, "unlockedAchievements": unlocked}
