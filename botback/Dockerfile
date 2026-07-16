# syntax=docker/dockerfile:1

# Бэкенд Telegram-бота (botback) для Railway — ОТДЕЛЬНАЯ служба (не сайт).
# Контекст сборки — КОРЕНЬ репозитория (нужны и core/, и requirements.txt).
# В настройках службы бота на Railway укажи Dockerfile Path = botback/Dockerfile,
# а Root Directory оставь пустым (корень репо). Сайт (siteback) продолжает
# собираться своим корневым ./Dockerfile — они не мешают друг другу.

FROM python:3.12-slim

# .pyc не пишем, вывод не буферизуем (логи сразу видны в Railway).
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Сначала зависимости — отдельным слоем, чтобы кэшировалось при неизменном requirements.txt.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Затем код: общий core/ (бот делает `from core import db, grok, grok_check`) и сам botback/.
COPY core/ ./core/
COPY botback/ ./botback/

# Бот работает по long-polling И поднимает рядом aiohttp-веб-сервер для мини-аппы
# (эндпоинты initData) — слушает $PORT, поэтому служба на Railway должна быть типа web.
CMD ["python", "-m", "botback.main"]
