"""Входы через сторонние сервисы: Google и Telegram.

Логика настоящая, но включается только когда в env заданы ключи (см. config).
Если ключей нет — эндпоинты в app.py вернут понятную ошибку «вход не настроен».

Google (стандартный OAuth 2.0):
    /api/auth/google/start    -> редирект на страницу согласия Google
    /api/auth/google/callback -> Google вернул code -> меняем на данные пользователя

Telegram (Login Widget):
    /api/auth/telegram/start    -> отдаём страничку с кнопкой Telegram
    /api/auth/telegram/callback -> Telegram прислал данные -> проверяем подпись
"""

from __future__ import annotations


import hashlib
import hmac
import time
from urllib.parse import urlencode

import httpx

from . import config

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


def google_redirect_uri() -> str:
    return f"{config.PUBLIC_BASE_URL}/api/auth/google/callback"


def google_auth_url(state: str) -> str:
    """Ссылка на страницу согласия Google, куда уводим пользователя."""
    params = {
        "client_id": config.GOOGLE_CLIENT_ID,
        "redirect_uri": google_redirect_uri(),
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


async def google_fetch_user(code: str) -> dict:
    """Меняет code на данные пользователя: {google_id, email, name}."""
    data = {
        "code": code,
        "client_id": config.GOOGLE_CLIENT_ID,
        "client_secret": config.GOOGLE_CLIENT_SECRET,
        "redirect_uri": google_redirect_uri(),
        "grant_type": "authorization_code",
    }
    async with httpx.AsyncClient(timeout=15) as http:
        token_resp = await http.post(GOOGLE_TOKEN_URL, data=data)
        token_resp.raise_for_status()
        access_token = token_resp.json().get("access_token")
        if not access_token:
            raise ValueError("Google не вернул access_token")
        info_resp = await http.get(
            GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"}
        )
        info_resp.raise_for_status()
        info = info_resp.json()
    return {
        "google_id": info["sub"],
        "email": info.get("email"),
        "name": info.get("name"),
    }


def telegram_widget_html() -> str:
    """HTML-страница с официальной кнопкой Telegram Login Widget.

    Виджет после входа сам перенаправит пользователя на data-auth-url с данными
    аккаунта в query-параметрах (там мы проверим подпись).
    """
    callback = f"{config.PUBLIC_BASE_URL}/api/auth/telegram/callback"
    return f"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Вход через Telegram</title>
<style>body{{font-family:system-ui,sans-serif;display:flex;min-height:100vh;margin:0;
align-items:center;justify-content:center;background:#f5f5f7}}</style></head>
<body>
<script async src="https://telegram.org/js/telegram-widget.js?22"
  data-telegram-login="{config.TELEGRAM_BOT_USERNAME}"
  data-size="large"
  data-auth-url="{callback}"
  data-request-access="write"></script>
</body></html>"""


def verify_telegram_auth(params: dict) -> dict | None:
    """Проверяет подпись данных от Telegram Login Widget.

    Возвращает {telegram_id, username, name} при валидной подписи, иначе None.
    Алгоритм — из официальной документации Telegram (HMAC-SHA256 по данным,
    ключ = SHA256 от токена бота).
    """
    received_hash = params.get("hash")
    if not received_hash:
        return None
    # Строка проверки: все поля кроме hash, вида key=value, отсортированы, через \n.
    pairs = sorted(f"{k}={v}" for k, v in params.items() if k != "hash")
    data_check_string = "\n".join(pairs)
    secret_key = hashlib.sha256(config.TELEGRAM_BOT_TOKEN.encode()).digest()
    calc_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(calc_hash, received_hash):
        return None
    # Данные не старше суток — защита от переигрывания старой ссылки.
    try:
        if time.time() - int(params.get("auth_date", "0")) > 86400:
            return None
    except (TypeError, ValueError):
        return None
    name = " ".join(p for p in [params.get("first_name"), params.get("last_name")] if p)
    return {
        "telegram_id": int(params["id"]),
        "username": params.get("username"),
        "name": name or None,
    }
