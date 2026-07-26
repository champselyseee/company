"""Настройки бэкенда Telegram-бота: токен, доступ, контакты. Всё из переменных окружения."""

import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:  # локально без пакета — переменные всё равно читаются из окружения
    pass


# Токен бота от @BotFather (обязателен для запуска).
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN")

# Контакт поддержки — показываем в /help и в заглушке оплаты.
SUPPORT_CONTACT = os.environ.get("SUPPORT_CONTACT", "@champselyseee")

# Пользователи с безлимитным доступом (по Telegram-username, без @; регистр не важен).
WHITELIST = {"champselyseee", "dilaiip", "riavlw", "ENOTINA0", "ssmatwikss"}


# ── Мини-аппа (Telegram WebApp) ──
# Адрес мини-аппы (botfront на Vercel) — для inline-кнопки WebApp. Пусто → кнопку не показываем.
WEBAPP_URL = os.environ.get("WEBAPP_URL", "")
# Порт веб-сервера бота (обслуживает мини-аппу). На Railway задаётся автоматически.
PORT = int(os.environ.get("PORT", "8080"))
# Разрешённый источник (CORS) для мини-аппы. '*' допустимо: вход по initData в заголовке,
# куки не используются.
WEBAPP_ALLOWED_ORIGIN = os.environ.get("WEBAPP_ALLOWED_ORIGIN", "*")


def is_whitelisted(username: str | None) -> bool:
    """True, если username в белом списке (безлимитный доступ, без списания проверок)."""
    return bool(username) and username.lower() in {w.lower() for w in WHITELIST}
