"""Общий модуль доступа к базе (Postgres) для бота и сайта.

Это тот самый общий скрипт из папки core/: и бот, и сайт импортируют его и ходят
в базу только через него. Логика повторяет текущего бота (SQLite), но работает
через внутренний номер пользователя users.id и добавляет то, что нужно сайту
(вход по email/Google) и публичный счётчик проверок.

Строка подключения берётся из переменной окружения DATABASE_URL (её выдаёт Railway).

CLI для проверки:
    python -m db --init       # создать/обновить таблицы
    python -m db --selftest   # быстрый прогон: создать юзера, начислить, списать, проверить
"""

import os
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
from psycopg_pool import ConnectionPool
from psycopg.rows import dict_row

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
SCHEMA_PATH = Path(__file__).with_name("schema.sql")

# Месячная норма проверок по активной подписке (сбрасывается каждый календарный месяц).
SUBSCRIPTION_MONTHLY_QUOTA = 30

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


def get_user_by_email(email: str) -> dict | None:
    """Ищет пользователя по email (для входа по паролю). None — не найден."""
    email = email.strip().lower()
    with _conn() as conn:
        return conn.execute("SELECT * FROM users WHERE email = %s", (email,)).fetchone()


def create_email_user(
    email: str, password_hash: str, display_name: str | None = None
) -> dict | None:
    """Создаёт нового пользователя с email и хешом пароля (регистрация на сайте).

    Атомарно защищено от гонки: если такой email уже есть, ON CONFLICT ничего не
    вставляет и возвращает None (caller отдаёт аккуратную ошибку «email занят»),
    вместо падения на нарушении UNIQUE при одновременных регистрациях.
    """
    email = email.strip().lower()
    with _conn() as conn:
        row = conn.execute(
            "INSERT INTO users (email, password_hash, display_name) "
            "VALUES (%s, %s, %s) ON CONFLICT (email) DO NOTHING RETURNING *",
            (email, password_hash, display_name),
        ).fetchone()
        conn.commit()
        return row


def set_password_hash(user_id: int, password_hash: str) -> None:
    """Задаёт/меняет хеш пароля (регистрация, восстановление)."""
    with _conn() as conn:
        conn.execute(
            "UPDATE users SET password_hash = %s WHERE id = %s", (password_hash, user_id)
        )
        conn.commit()


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


def _add_subscription_tx(conn, user_id: int, days: int, quota: int | None) -> datetime:
    """Продление подписки ВНУТРИ уже открытой транзакции (без commit).

    Срок — от текущего конца (если подписка ещё активна) либо от сейчас. quota — месячная
    норма тарифа: при активной подписке берём большую из текущей и новой (купил «Месяц»
    поверх «Года» — 120 не падает); None — оставить норму активной подписки как есть
    (у истёкшей — сбросить к умолчанию 30).
    """
    row = conn.execute(
        "SELECT subscription_until, sub_quota FROM users WHERE id = %s FOR UPDATE", (user_id,)
    ).fetchone()
    now = _now()
    active = bool(row and row["subscription_until"] and row["subscription_until"] > now)
    new_until = (row["subscription_until"] if active else now) + timedelta(days=days)
    current_quota = row["sub_quota"] if (row and active) else None
    if quota is None:
        new_quota = current_quota
    else:
        new_quota = max(quota, current_quota or 0)
    conn.execute(
        "UPDATE users SET subscription_until = %s, sub_quota = %s WHERE id = %s",
        (new_until, new_quota, user_id),
    )
    return new_until


def add_subscription(user_id: int, days: int = 30, quota: int | None = None) -> datetime:
    """Продлевает подписку на days дней (quota — месячная норма тарифа, см. _add_subscription_tx)."""
    with _conn() as conn:
        new_until = _add_subscription_tx(conn, user_id, days, quota)
        conn.commit()
        return new_until


def has_subscription(user: dict) -> bool:
    su = user.get("subscription_until")
    return su is not None and su > _now()


def subscription_quota(user: dict) -> int:
    """Месячная норма подписки пользователя (sub_quota; NULL у старых подписок = 30)."""
    return user.get("sub_quota") or SUBSCRIPTION_MONTHLY_QUOTA


def subscription_left(user: dict) -> int:
    """Сколько проверок по подписке осталось в текущем календарном месяце (0..квота).

    0 — если подписки нет. Счётчик sub_used обнуляется в начале нового месяца
    (сравниваем сохранённый sub_month с текущим 'YYYY-MM' по UTC).
    """
    if not has_subscription(user):
        return 0
    used = user.get("sub_used") or 0
    if user.get("sub_month") != _now().strftime("%Y-%m"):
        used = 0
    return max(0, subscription_quota(user) - used)


def has_access(user: dict) -> bool:
    return subscription_left(user) > 0 or user.get("paid_checks", 0) > 0


def consume_check(user_id: int) -> str | None:
    """Атомарно проверяет доступ и списывает ОДНУ проверку. Возвращает, что списано:

    - "subscription" — покрыто активной подпиской в пределах месячной нормы
      (SUBSCRIPTION_MONTHLY_QUOTA); sub_used += 1, при смене месяца счётчик обнуляется;
    - "free"         — списана бесплатная (free_used стал TRUE);
    - "paid"         — списана одна оплаченная (paid_checks -= 1);
    - None           — списывать нечего (нет доступа) → caller отдаёт 402.

    Строка пользователя блокируется (FOR UPDATE) на время транзакции, поэтому два
    одновременных запроса не могут списать одну и ту же проверку (без гонки).
    Порядок: подписка (месячная норма) → бесплатная → оплаченные.
    """
    with _conn() as conn:
        row = conn.execute(
            "SELECT free_used, paid_checks, subscription_until, sub_used, sub_month, sub_quota "
            "FROM users WHERE id = %s FOR UPDATE",
            (user_id,),
        ).fetchone()
        if row is None:
            conn.rollback()
            return None
        now = _now()
        su = row["subscription_until"]
        if su is not None and su > now:
            # Активная подписка: месячная норма тарифа (sub_quota, по умолчанию 30).
            current_month = now.strftime("%Y-%m")
            used = row["sub_used"] or 0
            if row["sub_month"] != current_month:
                used = 0  # новый месяц — норма обнуляется
            if used < subscription_quota(row):
                conn.execute(
                    "UPDATE users SET sub_used = %s, sub_month = %s WHERE id = %s",
                    (used + 1, current_month, user_id),
                )
                conn.commit()
                return "subscription"
            # месячная норма исчерпана → пробуем бесплатную/оплаченные ниже
        if not row["free_used"]:
            conn.execute("UPDATE users SET free_used = TRUE WHERE id = %s", (user_id,))
            conn.commit()
            return "free"
        if row["paid_checks"] > 0:
            conn.execute(
                "UPDATE users SET paid_checks = paid_checks - 1 WHERE id = %s", (user_id,)
            )
            conn.commit()
            return "paid"
        conn.rollback()
        return None


def refund_check(user_id: int, kind: str) -> None:
    """Возврат проверки, списанной consume_check, если ИИ так и не ответил.

    kind — то, что вернула consume_check: "free"/"paid"/"subscription".
    """
    if kind == "free":
        with _conn() as conn:
            conn.execute("UPDATE users SET free_used = FALSE WHERE id = %s", (user_id,))
            conn.commit()
    elif kind == "paid":
        add_paid_checks(user_id, 1)
    elif kind == "subscription":
        with _conn() as conn:
            conn.execute(
                "UPDATE users SET sub_used = GREATEST(0, sub_used - 1) WHERE id = %s",
                (user_id,),
            )
            conn.commit()


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


def referral_stats(referrer_id: int) -> tuple[int, int]:
    """(сколько человек пригласил, сколько из них уже принесли бонус — т.е. оплатили)."""
    with _conn() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE rewarded) AS rewarded "
            "FROM referrals WHERE referrer_id = %s",
            (referrer_id,),
        ).fetchone()
        return row["total"], row["rewarded"]


# ── Напоминания ──
# Функции «забирают» (claim) пользователей, которым пора напомнить: отмечают отправку
# в той же транзакции и возвращают, кому писать. Отметка ДО отправки + SKIP LOCKED —
# даже два одновременно запущенных бота не пришлют одно напоминание дважды.

INACTIVE_AFTER = timedelta(days=3)          # столько молчания — повод напомнить
INACTIVE_ACTIVE_WINDOW = timedelta(days=30)  # давно ушедших (активность старше) не трогаем
INACTIVE_REPEAT_EVERY = timedelta(days=7)    # повтор не чаще раза в неделю
INACTIVE_MAX_REMINDERS = 2                   # максимум напоминаний подряд без новой активности
SUB_END_REMIND_BEFORE = timedelta(days=3)    # за сколько до конца подписки предупредить


def claim_inactive_reminders(limit: int = 200) -> list[dict]:
    """Кому пора «давно не проверял работу». Возвращает [{id, telegram_id, username}].

    Активность = последняя проверка (history), а если проверок не было — регистрация.
    Условия: молчит больше INACTIVE_AFTER, но активность свежее INACTIVE_ACTIVE_WINDOW;
    с последней активности напоминаний не было, либо было меньше INACTIVE_MAX_REMINDERS
    и последнее — раньше INACTIVE_REPEAT_EVERY. Новая проверка обнуляет счётчик
    (напоминание «старше» активности считается прошлым периодом молчания).
    """
    now = _now()
    params = {
        "now": now,
        "quiet_since": now - INACTIVE_AFTER,
        "active_since": now - INACTIVE_ACTIVE_WINDOW,
        "repeat_since": now - INACTIVE_REPEAT_EVERY,
        "max": INACTIVE_MAX_REMINDERS,
        "limit": limit,
    }
    with _conn() as conn:
        rows = conn.execute(
            """
            WITH due AS (
                SELECT u.id, a.last_act
                FROM users u
                CROSS JOIN LATERAL (
                    SELECT COALESCE(
                        (SELECT max(h.created_at) FROM history h WHERE h.user_id = u.id),
                        u.created_at
                    ) AS last_act
                ) a
                WHERE u.telegram_id IS NOT NULL
                  AND a.last_act < %(quiet_since)s
                  AND a.last_act > %(active_since)s
                  AND (
                        u.inactive_reminded_at IS NULL
                     OR u.inactive_reminded_at < a.last_act
                     OR (u.inactive_reminders < %(max)s AND u.inactive_reminded_at < %(repeat_since)s)
                  )
                LIMIT %(limit)s
                FOR UPDATE OF u SKIP LOCKED
            )
            UPDATE users SET
                inactive_reminders = CASE
                    WHEN users.inactive_reminded_at IS NULL OR users.inactive_reminded_at < due.last_act
                    THEN 1 ELSE users.inactive_reminders + 1 END,
                inactive_reminded_at = %(now)s
            FROM due
            WHERE users.id = due.id
            RETURNING users.id, users.telegram_id, users.username
            """,
            params,
        ).fetchall()
        conn.commit()
        return rows


def claim_subscription_end_reminders(limit: int = 200) -> list[dict]:
    """Кому пора «подписка скоро закончится» — один раз на каждую дату конца подписки.

    Возвращает [{id, telegram_id, username, subscription_until}].
    """
    now = _now()
    with _conn() as conn:
        rows = conn.execute(
            """
            UPDATE users SET sub_end_reminded_for = subscription_until
            WHERE id IN (
                SELECT id FROM users
                WHERE telegram_id IS NOT NULL
                  AND subscription_until > %s
                  AND subscription_until <= %s
                  AND sub_end_reminded_for IS DISTINCT FROM subscription_until
                LIMIT %s
                FOR UPDATE SKIP LOCKED
            )
            RETURNING id, telegram_id, username, subscription_until
            """,
            (now, now + SUB_END_REMIND_BEFORE, limit),
        ).fetchall()
        conn.commit()
        return rows


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


def grant_payment(
    payment_id: str,
    user_id: int,
    amount=None,
    *,
    checks: int = 0,
    days: int = 0,
    quota: int | None = None,
    provider: str = "yookassa",
) -> bool:
    """Атомарно помечает платёж обработанным И начисляет покупку — ОДНОЙ транзакцией.

    True — платёж новый, начислено; False — этот payment_id уже был (повтор уведомления),
    ничего не делаем. Если начисление упадёт, откатится и пометка, и повтор уведомления
    начислит заново (раньше пометка и начисление шли разными транзакциями).
    """
    with _conn() as conn:
        row = conn.execute(
            "INSERT INTO processed_payments (payment_id, user_id, amount, provider) "
            "VALUES (%s, %s, %s, %s) ON CONFLICT (payment_id) DO NOTHING RETURNING payment_id",
            (payment_id, user_id, amount, provider),
        ).fetchone()
        if row is None:
            conn.rollback()
            return False
        if checks:
            conn.execute(
                "UPDATE users SET paid_checks = paid_checks + %s WHERE id = %s", (checks, user_id)
            )
        if days:
            _add_subscription_tx(conn, user_id, days, quota)
        conn.commit()
        return True


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
            "SELECT id, work_type, result, created_at FROM history "
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

    # подписка: месячная норма (списание + возврат)
    add_subscription(uid, 30)
    assert subscription_left(get_user_by_id(uid)) == SUBSCRIPTION_MONTHLY_QUOTA, "новая подписка — полная норма"
    assert consume_check(uid) == "subscription", "по подписке списывается 'subscription'"
    assert subscription_left(get_user_by_id(uid)) == SUBSCRIPTION_MONTHLY_QUOTA - 1, "норма уменьшилась на 1"
    refund_check(uid, "subscription")
    assert subscription_left(get_user_by_id(uid)) == SUBSCRIPTION_MONTHLY_QUOTA, "refund вернул норму"
    print(f"подписка: норма {SUBSCRIPTION_MONTHLY_QUOTA}/мес — списание/возврат OK")

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
        print("Использование: python -m db [--init | --selftest]")
