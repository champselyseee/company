"""Каталог тарифов и типов работ — серверная правда о ценах и количестве проверок.

Общий для бота и сайта (core/). Сколько проверок начислить и сколько это стоит, решает
СЕРВЕР по id тарифа, а не данные из запроса (иначе цену/количество можно подделать).
Значения должны совпадать с sitefront/src/lib/billing.ts и workTypes.ts.
"""

from __future__ import annotations


# Пакеты разовых проверок: id -> сколько проверок и цена в рублях.
PACKAGES: dict[str, dict] = {
    "p1": {"checks": 1, "price": 49},
    "p5": {"checks": 5, "price": 199},
    "p10": {"checks": 10, "price": 349},
}

# Подписки: id -> имя, месячная норма проверок, срок в днях, цена.
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


def checks_word(n: int) -> str:
    """1 проверка, 2 проверки, 5 проверок."""
    if n % 10 == 1 and n % 100 != 11:
        return "проверка"
    if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14:
        return "проверки"
    return "проверок"


def get_offer(kind: str, offer_id: str) -> dict | None:
    """Тариф по виду и id: {kind, id, price, checks, days, quota, title}. None — такого нет.

    package — разовые проверки (checks > 0); plan — подписка на days дней с месячной
    нормой quota (checks = 0).
    """
    if kind == "package":
        item = PACKAGES.get(offer_id)
        if item is None:
            return None
        n = item["checks"]
        return {"kind": kind, "id": offer_id, "price": item["price"], "checks": n,
                "days": 0, "quota": None, "title": f"{n} {checks_word(n)}"}
    if kind == "plan":
        item = PLANS.get(offer_id)
        if item is None:
            return None
        return {"kind": kind, "id": offer_id, "price": item["price"], "checks": 0,
                "days": item["days"], "quota": item["checks_per_month"],
                "title": f"подписка «{item['name']}» ({item['checks_per_month']} проверок в месяц)"}
    return None


def all_offers() -> list[dict]:
    """Все тарифы по порядку: сначала пакеты, потом подписки (для кнопок /buy в боте)."""
    return [get_offer("package", k) for k in PACKAGES] + [get_offer("plan", k) for k in PLANS]
