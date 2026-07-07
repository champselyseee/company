"""Безопасность: пароли и вход по куке-сессии.

- Пароль храним не как есть, а как bcrypt-хеш (необратимо). Проверка — сравнением.
- «Кто вошёл» держим в подписанной куке: внутри лежит только users.id, подписанный
  секретом (itsdangerous). Подделать нельзя, отдельная таблица сессий не нужна.
"""

from __future__ import annotations


import bcrypt
from fastapi import Request, HTTPException, Response
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from . import config

try:  # запуск как пакет (core.db) или как одиночный модуль (db) — как в claude.py
    from core import db
except ImportError:  # pragma: no cover
    import db  # type: ignore


# ── Пароли (bcrypt) ──

def hash_password(password: str) -> str:
    """Возвращает bcrypt-хеш пароля (строка для колонки password_hash)."""
    # bcrypt работает максимум с 72 байтами — лишнее безопасно отбрасываем.
    raw = password.encode("utf-8")[:72]
    return bcrypt.hashpw(raw, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str | None) -> bool:
    """True, если пароль подходит к хешу. False, если хеша нет или не совпал."""
    if not password_hash:
        return False
    raw = password.encode("utf-8")[:72]
    try:
        return bcrypt.checkpw(raw, password_hash.encode("utf-8"))
    except ValueError:
        return False


# ── Сессия (подписанная кука) ──

_serializer = URLSafeTimedSerializer(config.SESSION_SECRET, salt="ege-session")
_MAX_AGE = config.SESSION_TTL_DAYS * 24 * 60 * 60


def set_session(response: Response, user_id: int) -> None:
    """Кладёт в ответ куку с подписанным users.id (пользователь «залогинен»)."""
    token = _serializer.dumps(user_id)
    response.set_cookie(
        key=config.SESSION_COOKIE_NAME,
        value=token,
        max_age=_MAX_AGE,
        httponly=True,                    # JS со страницы куку не прочитает
        secure=config.COOKIE_SECURE,      # только по https (в проде true)
        samesite=config.COOKIE_SAMESITE,  # none — чтобы работало между Vercel и Railway
        path="/",
    )


def clear_session(response: Response) -> None:
    """Стирает куку сессии (выход)."""
    response.delete_cookie(
        key=config.SESSION_COOKIE_NAME,
        path="/",
        samesite=config.COOKIE_SAMESITE,
        secure=config.COOKIE_SECURE,
    )


def _user_id_from_request(request: Request) -> int | None:
    token = request.cookies.get(config.SESSION_COOKIE_NAME)
    if not token:
        return None
    try:
        return _serializer.loads(token, max_age=_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None


# ── Зависимости FastAPI ──

def current_user(request: Request) -> dict:
    """Пользователь по куке. Нет валидной сессии — 401 (фронт трактует как гостя)."""
    user_id = _user_id_from_request(request)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Нужно войти в аккаунт")
    user = db.get_user_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="Нужно войти в аккаунт")
    return user


def current_user_optional(request: Request) -> dict | None:
    """Как current_user, но без ошибки: возвращает None, если сессии нет."""
    user_id = _user_id_from_request(request)
    if user_id is None:
        return None
    return db.get_user_by_id(user_id)
