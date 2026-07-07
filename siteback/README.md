# siteback — бэкенд сайта ЕГЭ-чекера

FastAPI-сервер для веб-версии. Отдаёт API, которое уже ждёт фронт (`sitefront/`),
а всю работу с базой и ИИ делает через общий код `core/` (`db.py`, `claude.py`, `grok.py`).
Своего SQL и своих обращений к моделям здесь нет — только «перевод» HTTP-запросов
в вызовы `core`.

## Эндпоинты (что отдаём фронту)

| Метод | Путь | Назначение |
|---|---|---|
| GET  | `/api/me` | текущий пользователь по куке (401 — не вошёл) |
| POST | `/api/auth/register` | регистрация по email+пароль |
| POST | `/api/auth/login` | вход по email+пароль |
| POST | `/api/auth/logout` | выход |
| POST | `/api/auth/forgot` | запрос восстановления пароля (пока без письма) |
| GET  | `/api/auth/google/start` · `/callback` | вход через Google |
| GET  | `/api/auth/telegram/start` · `/callback` | вход через Telegram (Login Widget) |
| POST | `/api/checks` | проверить работу → `{result, balance}` |
| POST | `/api/ocr` | фото (multipart `image`) → распознанный текст |
| GET  | `/api/history?limit=` | последние проверки пользователя |
| GET  | `/api/profile` | статистика профиля и достижения |
| POST | `/api/payments` | создать платёж (пока режим-заглушка) |
| GET  | `/api/public/total-checks` | публичный счётчик (без входа) |

## Как это работает

- **Сессия** — подписанная кука (`itsdangerous`), внутри только `users.id`. Отдельной
  таблицы сессий нет. Между доменами Vercel↔Railway нужна кука `Secure; SameSite=None`
  (см. `COOKIE_SECURE` / `COOKIE_SAMESITE`).
- **Баланс** = оплаченные проверки + одна бесплатная (если не использована).
  Проверка списывается только после успешного ответа ИИ.
- **Оплата** — режим `stub`: платёж сразу считается прошедшим и проверки начисляются
  (для разработки). Реальную ЮKassa/Stars подключим отдельным шагом.
- **Google/Telegram** включаются только когда заданы их ключи в env; иначе эндпоинт
  вернёт понятную ошибку «вход не настроен» (email+пароль работает всегда).

## Запуск локально

```bash
# из КОРНЯ репозитория (чтобы был виден пакет core/)
pip install -r requirements.txt
cp siteback/.env.example siteback/.env   # заполни DATABASE_URL и ключи
uvicorn siteback.app:app --reload --port 8000
```

Документация API (Swagger) — на `/api/docs`.

## Деплой на Railway

Отдельная служба из этого же репозитория:
- **Root Directory** = корень репо (чтобы `siteback` видел соседний `core/`).
- **Start Command** = `uvicorn siteback.app:app --host 0.0.0.0 --port $PORT`.
- Переменные — из `siteback/.env.example` (`DATABASE_URL` — ссылкой на Postgres).
