"""Каталог тарифов и типов работ — серверная правда о ценах и количестве проверок.

Важно: сколько проверок начислить и сколько это стоит, решает СЕРВЕР по id, а не
данные из запроса фронта (иначе цену/количество можно было бы подделать). Значения
должны совпадать с sitefront/src/lib/billing.ts и workTypes.ts.
"""

from __future__ import annotations


# Пакеты разовых проверок: id -> сколько проверок и цена в рублях.
PACKAGES: dict[str, dict] = {
    "p1": {"checks": 1, "price": 49},
    "p5": {"checks": 5, "price": 199},
    "p10": {"checks": 10, "price": 349},
}

# Подписки: id -> человекочитаемое имя, месячная норма проверок, срок в днях, цена.
PLANS: dict[str, dict] = {
    "month": {"name": "Месяц", "checks_per_month": 30, "days": 30, "price": 299},
    "semester": {"name": "Семестр", "checks_per_month": 60, "days": 180, "price": 1290},
    "year": {"name": "Год", "checks_per_month": 120, "days": 365, "price": 2190},
}

# Типы работ: ключ совпадает с PROMPTS в core/claude.py и WorkType на фронте.
# title — заголовок для списка истории (как WORK_TYPES[...].title во фронте).
WORK_TYPE_TITLES: dict[str, str] = {
    "email": "Английский Email",
    "essay": "Английское эссе",
    "composition": "Русское сочинение",
}

VALID_WORK_TYPES = set(WORK_TYPE_TITLES)
