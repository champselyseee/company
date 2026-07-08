# syntax=docker/dockerfile:1

# Бэкенд сайта (siteback) для Railway.
# Собираем детерминированно, без авто-угадывания: ставим зависимости, кладём общий
# код core/ рядом с siteback/ и запускаем uvicorn на порту, который даёт Railway ($PORT).

FROM python:3.12-slim

# .pyc не пишем, вывод не буферизуем (логи сразу видны в Railway).
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Сначала зависимости — отдельным слоем, чтобы кэшировалось при неизменном requirements.txt.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Затем сам код: общий core/ и бэкенд сайта siteback/.
# core/ обязателен рядом — siteback/app.py делает `from core import db`.
COPY core/ ./core/
COPY siteback/ ./siteback/

# Railway передаёт порт в $PORT. Shell-форма CMD — чтобы переменная подставилась.
CMD uvicorn siteback.app:app --host 0.0.0.0 --port $PORT
