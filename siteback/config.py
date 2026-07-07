"""Настройки бэкенда сайта (siteback).

Все «крутилки» собраны здесь и берутся из переменных окружения (env). На Railway
их задают в разделе Variables; локально — в файле .env (см. .env.example).
Ничего секретного в коде не храним.
"""

from __future__ import annotations


import os


def _env_list(name: str, default: str = "") -> list[str]:
    """Читает переменную-список через запятую: 'a, b' -> ['a', 'b']."""
    raw = os.environ.get(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


# ── Куда пускаем фронт (CORS) ──
# Адрес(а) сайта на Vercel. Куки-сессия работает между разными доменами
# (Vercel и Railway) только если фронт перечислен здесь явно — '*' с куками нельзя.
FRONT_ORIGINS = _env_list("FRONT_ORIGINS", "http://localhost:5173")

# Публичный адрес самого siteback (нужен для OAuth-возвратов), напр.
# https://siteback.up.railway.app. Без хвостового слэша.
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "").rstrip("/")

# Куда вернуть пользователя на фронт после входа через Google/Telegram.
FRONT_REDIRECT_URL = os.environ.get("FRONT_REDIRECT_URL", "").rstrip("/") or (
    FRONT_ORIGINS[0] if FRONT_ORIGINS else "http://localhost:5173"
)

# ── Сессия (подписанная кука) ──
# Секрет для подписи куки. ОБЯЗАТЕЛЬНО задать свой в проде (длинная случайная строка).
SESSION_SECRET = os.environ.get("SESSION_SECRET", "dev-insecure-change-me")
SESSION_COOKIE_NAME = os.environ.get("SESSION_COOKIE_NAME", "ege_session")
SESSION_TTL_DAYS = int(os.environ.get("SESSION_TTL_DAYS", "30"))
# В проде (разные домены Vercel/Railway) нужны Secure + SameSite=None.
# Локально по http поставь COOKIE_SECURE=false и COOKIE_SAMESITE=lax.
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "true").lower() == "true"
COOKIE_SAMESITE = os.environ.get("COOKIE_SAMESITE", "none").lower()  # none | lax | strict

# ── Платежи ──
# 'stub' — режим-заглушка: платёж сразу помечается оплаченным и проверки начисляются
# (для разработки, реальных денег нет). Позже добавим 'yookassa'.
PAYMENTS_MODE = os.environ.get("PAYMENTS_MODE", "stub").lower()

# ── OAuth (входы через сторонние сервисы) ──
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
# Токен и username Telegram-бота — для проверки подписи Telegram Login Widget.
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_BOT_USERNAME = os.environ.get("TELEGRAM_BOT_USERNAME", "")


def google_configured() -> bool:
    return bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET and PUBLIC_BASE_URL)


def telegram_configured() -> bool:
    return bool(TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME and PUBLIC_BASE_URL)
