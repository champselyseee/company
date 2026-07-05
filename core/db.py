"""Общий модуль доступа к базе (Postgres) для бота и сайта.

Это тот самый общий скрипт из папки core/: и бот, и сайт импортируют его и ходят
в базу только через него. Логика повторяет текущего бота (SQLite), но работает
через внутренний номер пользователя users.id и добавляет то, что нужно сайту
(вход по email/Google) и публичный счётчик проверок.

Строка подключения берётся из переменной окружения DATABASE_URL (её выдаёт Railway).

CLI для проверки:
    python -m core.db --init       # создать/обновить таблицы
    python -m core.db --selftest   # быстрый прогон: создать юзера, начислить, списать, проверить
"""

import os
import secrets
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
from psycopg_pool import ConnectionPool
from psycopg.rows import dict_row

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
SCHEMA_PATH = Path(__file__).with_name("schema.sql")
TOKEN_TTL_SECONDS = 2 * 60 * 60  # ключ доступа к мини-аппу живёт 2 часа, как в боте

_pool: ConnectionPool | None = None


def pool() -> ConnectionPool:
    """Ленивое создание пула соединений (открывается при первом обращении)."""
    global _pool
    if _pool is None:
        if not DATABASE_URL:
            raise RuntimeError(
                "DATABASE_URL не задан. Укажи строку подключения к Postgres "
                "(в Railway она появляется автоматически; локально — в .env)."
            )
        _pool = ConnectionPool(
            conninfo=DATABASE_URL,
            min_size=1,
            max_size=10,
            kwargs={"row_factory": dict_row},
            open=False,
        )
        _pool.open()
    return _pool


@contextmanager
def _conn():
    """Соединение из пула. Пишущие функции внутри вызывают conn.commit() явно."""
    with pool().connection() as conn:
        yield conn


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _expired(created_at: datetime) -> bool:
    return (_now() - created_at).total_seconds() > TOKEN_TTL_SECONDS


# ── Схема ──

def init_schema() -> None:
    """Создаёт/обновляет все таблицы. Идемпотентно."""
    sql = SCHEMA_PATH.read_text(encoding="utf-8")
    statements = [s.strip() for s in sql.split(";") if s.strip()]
    with _conn() as conn:
        for statement in statements:
            conn.execute(statement)
        conn.commit()


# ── Пользователи / идентификация ──

def get_or_create_telegram_user(telegram_id: int, username: str | None = None) -> dict:
    with _conn() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE telegram_id = %s", (telegram_id,)
        ).fetchone()
        if row is None:
            row = conn.execute(
                "INSERT INTO users (telegram_id, username) VALUES (%s, %s) RETURNING *",
                (telegram_id, username),
            ).fetchone()
        elif username and row["username"] != username:
            conn.execute(
                "UPDATE users SET username = %s WHERE id = %s", (username, row["id"])
            )
            row["username"] = username
        conn.commit()
        return row


def get_or_create_email_user(email: str, display_name: str | None = None) -> dict:
    email = email.strip().lower()
    with _conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = %s", (email,)).fetchone()
        if row is None:
            row = conn.execute(
                "INSERT INTO users (email, display_name) VALUES (%s, %s) RETURNING *",
                (email, display_name),
            ).fetchone()
        conn.commit()
        return row


def get_or_create_google_user(
    google_id: str, email: str | None = None, display_name: str | None = None
) -> dict:
    with _conn() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE google_id = %s", (google_id,)
        ).fetchone()
        if row is None:
            row = conn.execute(
                "INSERT INTO users (google_id, email, display_name) "
                "VALUES (%s, %s, %s) RETURNING *",
                (google_id, email.strip().lower() if email else None, display_name),
            ).fetchone()
        conn.commit()
        return row


def get_user_by_id(user_id: int) -> dict | None:
    with _conn() as conn:
        return conn.execute("SELECT * FROM users WHERE id = %s", (user_id,)).fetchone()


def get_user_by_telegram_id(telegram_id: int) -> dict | None:
    with _conn() as conn:
        return conn.execute(
            "SELECT * FROM users WHERE telegram_id = %s", (telegram_id,)
        ).fetchone()


# ── Баланс и доступ ──

def use_free_check(user_id: int) -> None:
    with _conn() as conn:
        conn.execute("UPDATE users SET free_used = TRUE WHERE id = %s", (user_id,))
        conn.commit()


def add_paid_checks(user_id: int, count: int) -> None:
    with _conn() as conn:
        conn.execute(
            "UPDATE users SET paid_checks = paid_checks + %s WHERE id = %s",
            (count, user_id),
        )
        conn.commit()


def use_paid_check(user_id: int) -> None:
    with _conn() as conn:
        conn.execute(
            "UPDATE users SET paid_checks = GREATEST(0, paid_checks - 1) WHERE id = %s",
            (user_id,),
        )
        conn.commit()


def add_subscription(user_id: int, days: int = 30) -> datetime:
    """Продлевает подписку: от текущего конца (если ещё активна) либо от сейчас."""
    with _conn() as conn:
        row = conn.execute(
            "SELECT subscription_until FROM users WHERE id = %s", (user_id,)
        ).fetchone()
        now = _now()
        current = row["subscription_until"] if row and row["subscription_until"] and row["subscription_until"] > now else now
        new_until = current + timedelta(days=days)
        conn.execute(
            "UPDATE users SET subscription_until = %s WHERE id = %s", (new_until, user_id)
        )
        conn.commit()
        return new_until


def has_subscription(user: dict) -> bool:
    su = user.get("subscription_until")
    return su is not None and su > _now()


def has_access(user: dict) -> bool:
    return has_subscription(user) or user.get("paid_checks", 0) > 0


# ── Токены доступа к мини-аппу ──

def create_token(user_id: int) -> str:
    token = secrets.token_hex(16)
    with _conn() as conn:
        conn.execute(
            "INSERT INTO access_tokens (token, user_id) VALUES (%s, %s)", (token, user_id)
        )
        conn.commit()
    return token


def consume_token(token: str) -> int | None:
    """Атомарно проверяет и сжигает токен. Возвращает user_id или None."""
    with _conn() as conn:
        row = conn.execute(
            "SELECT user_id, used, created_at FROM access_tokens WHERE token = %s FOR UPDATE",
            (token,),
        ).fetchone()
        if row is None or row["used"] or _expired(row["created_at"]):
            conn.rollback()
            return None
        conn.execute("UPDATE access_tokens SET used = TRUE WHERE token = %s", (token,))
        conn.commit()
        return row["user_id"]


def validate_token(token: str) -> bool:
    """Только проверяет, не сжигает — для /check_token."""
    with _conn() as conn:
        row = conn.execute(
            "SELECT used, created_at FROM access_tokens WHERE token = %s", (token,)
        ).fetchone()
    if row is None:
        return False
    return not row["used"] and not _expired(row["created_at"])


def get_user_by_token(token: str) -> int | None:
    """Проверяет токен и возвращает user_id, не сжигая его."""
    with _conn() as conn:
        row = conn.execute(
            "SELECT user_id, used, created_at FROM access_tokens WHERE token = %s", (token,)
        ).fetchone()
    if row is None or row["used"] or _expired(row["created_at"]):
        return None
    return row["user_id"]


# ── Рефералы ──

def set_referrer(referred_id: int, referrer_id: int) -> None:
    if referred_id == referrer_id:
        return
    with _conn() as conn:
        exists = conn.execute(
            "SELECT 1 FROM referrals WHERE referred_id = %s", (referred_id,)
        ).fetchone()
        if exists:
            conn.rollback()
            return
        conn.execute(
            "INSERT INTO referrals (referrer_id, referred_id) VALUES (%s, %s)",
            (referrer_id, referred_id),
        )
        conn.execute(
            "UPDATE users SET referred_by = %s WHERE id = %s", (referrer_id, referred_id)
        )
        conn.commit()


def reward_referrer(referred_id: int) -> int | None:
    with _conn() as conn:
        row = conn.execute(
            "SELECT referrer_id, rewarded FROM referrals WHERE referred_id = %s",
            (referred_id,),
        ).fetchone()
        if not row or row["rewarded"]:
            conn.rollback()
            return None
        referrer_id = row["referrer_id"]
        conn.execute(
            "UPDATE referrals SET rewarded = TRUE WHERE referred_id = %s", (referred_id,)
        )
        conn.execute(
            "UPDATE users SET paid_checks = paid_checks + 1 WHERE id = %s", (referrer_id,)
        )
        conn.commit()
        return referrer_id


# ── Платежи ──

def mark_payment_processed(
    payment_id: str, user_id: int | None = None, amount=None, provider: str | None = None
) -> bool:
    """True — платёж новый (записан); False — этот payment_id уже начислялся (повтор)."""
    with _conn() as conn:
        row = conn.execute(
            "INSERT INTO processed_payments (payment_id, user_id, amount, provider) "
            "VALUES (%s, %s, %s, %s) ON CONFLICT (payment_id) DO NOTHING RETURNING payment_id",
            (payment_id, user_id, amount, provider),
        ).fetchone()
        conn.commit()
        return row is not None


# ── История проверок + публичный счётчик ──

def record_check(user_id: int, work_type: str, result: str, source: str = "bot") -> None:
    """Атомарно: пишет проверку в историю и увеличивает публичный счётчик total_checks."""
    with _conn() as conn:
        conn.execute(
            "INSERT INTO history (user_id, source, work_type, result) VALUES (%s, %s, %s, %s)",
            (user_id, source, work_type, result[:3000]),
        )
        conn.execute("UPDATE counters SET value = value + 1 WHERE name = 'total_checks'")
        conn.commit()


def get_history(user_id: int, limit: int = 5) -> list[dict]:
    with _conn() as conn:
        return conn.execute(
            "SELECT work_type, result, created_at FROM history "
            "WHERE user_id = %s ORDER BY created_at DESC LIMIT %s",
            (user_id, limit),
        ).fetchall()


def get_total_checks() -> int:
    """Публичное число: сколько всего проверок сделано (для главной страницы сайта)."""
    with _conn() as conn:
        row = conn.execute(
            "SELECT value FROM counters WHERE name = 'total_checks'"
        ).fetchone()
        return row["value"] if row else 0


# ── Датасет для дообучения ──

def save_training_sample(work_type: str, input_text: str) -> None:
    with _conn() as conn:
        conn.execute(
            "INSERT INTO training_data (work_type, input_text) VALUES (%s, %s)",
            (work_type, input_text),
        )
        conn.commit()


# ── CLI: инициализация схемы и самотест ──

def _selftest() -> None:
    init_schema()
    test_tg = 999999001  # заведомо «тестовый» telegram_id

    # на всякий случай убираем следы прошлого прогона
    with _conn() as conn:
        conn.execute("DELETE FROM users WHERE telegram_id = %s", (test_tg,))
        conn.commit()

    user = get_or_create_telegram_user(test_tg, "selftest_user")
    uid = user["id"]
    add_paid_checks(uid, 5)
    use_paid_check(uid)

    before = get_total_checks()
    record_check(uid, "essay_en", "тестовый разбор", source="bot")
    after = get_total_checks()

    fresh = get_user_by_id(uid)
    history = get_history(uid)

    print(f"user id: {uid}, telegram_id: {fresh['telegram_id']}")
    print(f"paid_checks (ожидаем 4): {fresh['paid_checks']}")
    print(f"записей в истории (ожидаем 1): {len(history)}")
    print(f"total_checks до -> после: {before} -> {after}")

    assert fresh["paid_checks"] == 4, "баланс должен быть 4"
    assert len(history) == 1, "в истории должна быть 1 запись"
    assert after == before + 1, "счётчик проверок должен вырасти на 1"

    # чистим тестовые данные и возвращаем счётчик как было
    with _conn() as conn:
        conn.execute("DELETE FROM users WHERE telegram_id = %s", (test_tg,))
        conn.execute(
            "UPDATE counters SET value = GREATEST(0, value - 1) WHERE name = 'total_checks'"
        )
        conn.commit()

    print("OK: самотест пройден, тестовые данные удалены")


if __name__ == "__main__":
    import sys

    arg = sys.argv[1] if len(sys.argv) > 1 else "--help"
    if arg == "--init":
        init_schema()
        print("OK: схема создана/обновлена")
    elif arg == "--selftest":
        _selftest()
    else:
        print("Использование: python -m core.db [--init | --selftest]")
