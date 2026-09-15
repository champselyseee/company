"""Бэкенд сайта ЕГЭ-чекера (siteback) — FastAPI.

Отдаёт ровно те эндпоинты, которые уже ждёт фронт (sitefront/src/lib/api/).
В базу и к ИИ ходит ТОЛЬКО через общий код core/ (db.py, claude.py, grok.py):
своего SQL и своих запросов к моделям здесь нет.

Запуск (из корня репозитория, как в README):
    uvicorn siteback.app:app --host 0.0.0.0 --port $PORT
"""

from __future__ import annotations


import base64
import io
import logging
import secrets
import time

from fastapi import (
    Depends, FastAPI, File, HTTPException, Query, Request, Response, UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel, EmailStr, Field
from starlette.concurrency import run_in_threadpool

from . import catalog, config, oauth, security, serializers
from .security import current_user

# Общий код core/ — как пакет (обычный запуск) или как модуль (запасной вариант).
try:
    from core import db
    from core.claude import check_work, ClaudeError
    from core.grok import ocr as grok_ocr, GrokError
    from core import yookassa
except ImportError:  # pragma: no cover
    import db  # type: ignore
    from claude import check_work, ClaudeError  # type: ignore
    from grok import ocr as grok_ocr, GrokError  # type: ignore
    import yookassa  # type: ignore

log = logging.getLogger("siteback")

# Логи общего core/ уровня INFO (напр. «Claude usage: … cache_read=N» — срабатывает ли кэш
# промпта). uvicorn настраивает только свои логгеры, без этого такие строки не видны.
_core_log = logging.getLogger("core")
if not _core_log.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s"))
    _core_log.addHandler(_handler)
    _core_log.propagate = False  # не дублировать, если корневой логгер тоже настроят
_core_log.setLevel(logging.INFO)

app = FastAPI(title="ЕГЭ-чекер · siteback", docs_url="/api/docs", openapi_url="/api/openapi.json")

# CORS: разрешаем фронту (Vercel/localhost) слать запросы с куками.
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.FRONT_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    """Создаём/обновляем таблицы при старте (идемпотентно). Если базы нет — не падаем."""
    try:
        db.init_schema()
    except Exception:  # noqa: BLE001 — сервис должен подняться даже без БД (health-check)
        log.exception("init_schema при старте не удался (проверь DATABASE_URL)")


# ── Модели запросов (то, что присылает фронт) ──

class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=200)
    name: str = Field(min_length=1, max_length=120)


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class ForgotBody(BaseModel):
    email: EmailStr


class CheckBody(BaseModel):
    workType: str
    taskText: str | None = None
    studentText: str = Field(min_length=1)


class PaymentBody(BaseModel):
    kind: str            # 'package' | 'plan'
    id: str
    method: str          # 'yookassa' | 'stars'
    promo: str | None = None


# ── Здоровье сервиса ──

@app.get("/")
@app.get("/api/health")
def health() -> dict:
    return {"service": "siteback", "ok": True}


# ── Авторизация ──

@app.get("/api/me")
def me(user: dict = Depends(current_user)) -> dict:
    return serializers.user_public(user)


@app.post("/api/auth/register")
def register(body: RegisterBody, response: Response) -> dict:
    # Атомарно: create_email_user вернёт None, если email уже занят (ON CONFLICT),
    # поэтому одновременные регистрации одного email не падают на UNIQUE, а дают 409.
    user = db.create_email_user(
        email=body.email,
        password_hash=security.hash_password(body.password),
        display_name=body.name,
    )
    if user is None:
        raise HTTPException(status_code=409, detail="Такой email уже зарегистрирован")
    security.set_session(response, user["id"])
    return {"user": serializers.user_public(user)}


@app.post("/api/auth/login")
def login(body: LoginBody, response: Response) -> dict:
    user = db.get_user_by_email(body.email)
    if user is None or not security.verify_password(body.password, user.get("password_hash")):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    security.set_session(response, user["id"])
    return {"user": serializers.user_public(user)}


@app.post("/api/auth/logout")
def logout(response: Response) -> dict:
    security.clear_session(response)
    return {"ok": True}


@app.post("/api/auth/forgot")
def forgot(body: ForgotBody) -> dict:
    # Отправки писем пока нет. Отвечаем одинаково всегда, чтобы не раскрывать,
    # зарегистрирован ли email. Реальную отправку добавим позже.
    log.info("Запрос восстановления пароля для %s (отправка не настроена)", body.email)
    return {"ok": True}


# ── Вход через Google ──

@app.get("/api/auth/google/start")
def google_start() -> Response:
    if not config.google_configured():
        raise HTTPException(status_code=503, detail="Вход через Google пока не настроен")
    state = secrets.token_urlsafe(16)
    resp = RedirectResponse(oauth.google_auth_url(state))
    # state кладём в короткую куку и сверяем в callback — защита от подделки запроса.
    resp.set_cookie(
        "oauth_state", state, max_age=600, httponly=True,
        secure=config.COOKIE_SECURE, samesite=config.COOKIE_SAMESITE, path="/",
    )
    return resp


@app.get("/api/auth/google/callback")
async def google_callback(request: Request, code: str | None = None, state: str | None = None) -> Response:
    if not config.google_configured():
        raise HTTPException(status_code=503, detail="Вход через Google пока не настроен")
    if not code or not state or state != request.cookies.get("oauth_state"):
        raise HTTPException(status_code=400, detail="Некорректный ответ от Google")
    try:
        info = await oauth.google_fetch_user(code)
    except Exception as e:  # noqa: BLE001
        log.exception("Google OAuth не удался")
        raise HTTPException(status_code=502, detail="Не удалось войти через Google") from e
    user = await run_in_threadpool(
        db.get_or_create_google_user,
        google_id=info["google_id"], email=info["email"], display_name=info["name"],
    )
    resp = RedirectResponse(config.FRONT_REDIRECT_URL)
    resp.delete_cookie("oauth_state", path="/")
    security.set_session(resp, user["id"])
    return resp


# ── Вход через Telegram (Login Widget) ──

@app.get("/api/auth/telegram/start")
def telegram_start() -> Response:
    if not config.telegram_configured():
        raise HTTPException(status_code=503, detail="Вход через Telegram пока не настроен")
    return HTMLResponse(oauth.telegram_widget_html())


@app.get("/api/auth/telegram/callback")
def telegram_callback(request: Request) -> Response:
    if not config.telegram_configured():
        raise HTTPException(status_code=503, detail="Вход через Telegram пока не настроен")
    data = oauth.verify_telegram_auth(dict(request.query_params))
    if data is None:
        raise HTTPException(status_code=400, detail="Не удалось подтвердить вход через Telegram")
    user = db.get_or_create_telegram_user(data["telegram_id"], data["username"])
    resp = RedirectResponse(config.FRONT_REDIRECT_URL)
    security.set_session(resp, user["id"])
    return resp


# ── Проверка работ ──

@app.post("/api/checks")
async def create_check(body: CheckBody, user: dict = Depends(current_user)) -> dict:
    if body.workType not in catalog.VALID_WORK_TYPES:
        raise HTTPException(status_code=400, detail="Неизвестный тип работы")

    # Резервируем проверку АТОМАРНО ещё до обращения к ИИ: consume_check под блокировкой
    # строки решает и «хватает ли доступа» (учитывая подписку), и списывает — так два
    # параллельных запроса не спишут одну и ту же проверку. db.* синхронный — уводим в
    # пул потоков, чтобы не блокировать общий цикл на время запроса к базе.
    kind = await run_in_threadpool(db.consume_check, user["id"])
    if kind is None:
        raise HTTPException(status_code=402, detail="Закончились проверки — пополните баланс")

    try:
        answer = await check_work(
            user_id=user["id"],
            work_type=body.workType,
            text=body.studentText,
            task_text=body.taskText,  # задание тоже уходит в Claude (раньше доходило только до ответа)
            source="site",
        )
    except ClaudeError as e:
        # ИИ не ответил — возвращаем зарезервированную проверку, чтобы не потерять её зря.
        await run_in_threadpool(db.refund_check, user["id"], kind)
        raise HTTPException(status_code=502, detail=f"ИИ не смог проверить работу: {e}") from e
    except Exception as e:
        # Любой другой сбой — тоже возвращаем проверку (как в боте), иначе она сгорит.
        await run_in_threadpool(db.refund_check, user["id"], kind)
        log.exception("Проверка на сайте не удалась (user_id=%s)", user["id"])
        raise HTTPException(status_code=500, detail="Не удалось проверить работу, проверка возвращена") from e

    fresh = await run_in_threadpool(db.get_user_by_id, user["id"])
    result = serializers.parse_result(answer)
    if body.taskText:
        result["task"] = {"text": body.taskText}
    return {"result": result, "balance": serializers.compute_balance(fresh)}


def _pdf_text(raw: bytes) -> str:
    """Текст из PDF (текстовый слой). Скан без текстового слоя → пустая строка."""
    from pypdf import PdfReader  # ленивый импорт: нужен только для PDF

    reader = PdfReader(io.BytesIO(raw))
    return "\n".join((page.extract_text() or "") for page in reader.pages).strip()


@app.post("/api/ocr")
async def recognize(image: UploadFile = File(...), user: dict = Depends(current_user)) -> dict:
    content_type = image.content_type or ""
    filename = (image.filename or "").lower()
    raw = await image.read()
    # PDF (кнопка «Файл задания»): достаём текстовый слой сами, без ИИ.
    if content_type == "application/pdf" or filename.endswith(".pdf"):
        try:
            text = await run_in_threadpool(_pdf_text, raw)
        except Exception as e:  # битый или зашифрованный PDF
            raise HTTPException(status_code=400, detail="Не удалось прочитать PDF") from e
        if not text:
            raise HTTPException(
                status_code=400, detail="В PDF нет текста (похоже на скан) — загрузите фото задания"
            )
        return {"text": text}
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Нужно фото или PDF")
    data_url = f"data:{content_type};base64,{base64.b64encode(raw).decode()}"
    try:
        text = await grok_ocr(data_url)
    except GrokError as e:
        raise HTTPException(status_code=502, detail=f"Не удалось распознать текст: {e}") from e
    return {"text": text}


@app.get("/api/history")
def history(limit: int = Query(default=5, ge=1, le=50), user: dict = Depends(current_user)) -> list[dict]:
    rows = db.get_history(user["id"], limit)
    return [serializers.history_item(r) for r in rows]


# ── Профиль ──

@app.get("/api/profile")
def profile(user: dict = Depends(current_user)) -> dict:
    rows = db.get_history(user["id"], limit=1000)  # берём историю целиком для статистики
    return serializers.profile_payload(rows)


# ── Оплата ──
# PAYMENTS_MODE: 'yookassa' — настоящая оплата; 'stub' — заглушка для разработки
# (сразу «оплачено»); любое другое значение (напр. 'off') — оплата выключена (501).

@app.post("/api/payments")
async def create_payment(body: PaymentBody, user: dict = Depends(current_user)) -> dict:
    if body.kind not in ("package", "plan"):
        raise HTTPException(status_code=400, detail="Неизвестный вид покупки")
    # Цену и что начислить решает сервер по каталогу, а не данные из запроса.
    offer = catalog.get_offer(body.kind, body.id)
    if offer is None:
        raise HTTPException(status_code=400, detail="Неизвестный тариф")

    if config.PAYMENTS_MODE == "yookassa":
        if body.method != "yookassa":
            raise HTTPException(status_code=400, detail="Оплата Stars — только в Telegram-боте")
        try:
            url = await yookassa.create_payment(
                user["id"], body.kind, body.id, return_url=config.FRONT_REDIRECT_URL, source="site"
            )
        except yookassa.YooKassaError as e:
            raise HTTPException(status_code=502, detail=f"Не удалось создать оплату: {e}") from e
        # Проверки начислит вебхук ЮKassa после оплаты (core/yookassa.handle_notification).
        return {"confirmationUrl": url, "status": "pending"}

    if config.PAYMENTS_MODE != "stub":
        raise HTTPException(status_code=501, detail="Оплата ещё не подключена")

    # Режим-заглушка (только для разработки): считаем, что оплата прошла сразу.
    payment_id = f"stub-{user['id']}-{int(time.time())}-{secrets.token_hex(4)}"
    await run_in_threadpool(
        db.grant_payment, payment_id, user["id"], offer["price"],
        checks=offer["checks"], days=offer["days"], quota=offer["quota"], provider=body.method,
    )
    return {"status": "paid"}


# ── Публичный счётчик (без авторизации) ──

@app.get("/api/public/total-checks")
def total_checks() -> dict:
    return {"totalChecks": db.get_total_checks()}
