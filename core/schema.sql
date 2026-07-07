-- Схема общей базы ЕГЭ-чекера (Postgres) для бота и сайта.
-- Идемпотентно: файл можно запускать повторно без вреда (IF NOT EXISTS / ON CONFLICT).

-- Пользователи: единая таблица для бота и сайта.
-- Главный ключ — внутренний номер id. Способы входа (telegram_id / email / google_id)
-- лежат отдельными полями: один и тот же баланс и история привязаны к человеку,
-- каким бы способом он ни вошёл. Хотя бы одна примета входа обязана быть заполнена.
CREATE TABLE IF NOT EXISTS users (
    id                 BIGSERIAL PRIMARY KEY,
    telegram_id        BIGINT UNIQUE,                  -- «телеграмные» (общие для бота и сайта)
    email              TEXT UNIQUE,                    -- сайтовые (вход по email)
    google_id          TEXT UNIQUE,                    -- сайтовые (вход через Google)
    username           TEXT,                           -- telegram @username
    display_name       TEXT,
    free_used          BOOLEAN NOT NULL DEFAULT FALSE, -- израсходована ли бесплатная проверка
    paid_checks        INTEGER NOT NULL DEFAULT 0,     -- остаток оплаченных проверок
    subscription_until TIMESTAMPTZ,                    -- NULL = нет подписки
    referred_by        BIGINT REFERENCES users(id),    -- кто пригласил
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_has_identity CHECK (
        telegram_id IS NOT NULL OR email IS NOT NULL OR google_id IS NOT NULL
    )
)

;

-- Хеш пароля для входа по email на сайте (bcrypt). NULL — пароль не задан
-- (пользователь входит через Telegram/Google). Держим отдельным ALTER, потому что
-- CREATE TABLE IF NOT EXISTS не меняет уже существующую таблицу, а ADD COLUMN
-- IF NOT EXISTS — идемпотентно добавит колонку и в старую базу, и в новую.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT

;

-- Одноразовые ключи доступа к мини-аппу (бот выдаёт при открытии WebApp, TTL 2 часа).
CREATE TABLE IF NOT EXISTS access_tokens (
    token      TEXT PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    used       BOOLEAN NOT NULL DEFAULT FALSE
)

;

-- История проверок (и бот, и сайт). source помечает, откуда пришла проверка.
CREATE TABLE IF NOT EXISTS history (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source     TEXT NOT NULL DEFAULT 'bot',       -- 'bot' | 'site'
    work_type  TEXT NOT NULL,
    result     TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)

;

CREATE INDEX IF NOT EXISTS history_user_created_idx ON history (user_id, created_at DESC)

;

-- Рефералы: кто кого пригласил и начислена ли награда.
CREATE TABLE IF NOT EXISTS referrals (
    referred_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    referrer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    rewarded    BOOLEAN NOT NULL DEFAULT FALSE
)

;

-- Обработанные платежи: защита от двойного начисления (идемпотентность вебхуков).
CREATE TABLE IF NOT EXISTS processed_payments (
    payment_id TEXT PRIMARY KEY,
    user_id    BIGINT REFERENCES users(id),
    amount     NUMERIC,
    provider   TEXT,                              -- 'stars' | 'yookassa'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)

;

-- Публичные счётчики для главной страницы сайта (напр. общее число проверок).
CREATE TABLE IF NOT EXISTS counters (
    name  TEXT PRIMARY KEY,
    value BIGINT NOT NULL DEFAULT 0
)

;

INSERT INTO counters (name, value) VALUES ('total_checks', 0)
    ON CONFLICT (name) DO NOTHING

;
