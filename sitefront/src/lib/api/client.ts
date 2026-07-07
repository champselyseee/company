/* Базовый клиент для обращений к бэкенду сайта (siteback).

   Адрес сервера берётся из переменной окружения VITE_API_URL (см. .env.example
   в корне sitefront). Пока бэкенда нет, переменная пустая — сетевые запросы не
   отправляются, request() сразу бросает ApiError('Сервер пока не подключён'),
   а страницы показывают аккуратные пустые состояния (нули/«пока ничего нет»).

   Когда появится siteback — достаточно прописать VITE_API_URL: весь фронт
   заработает без переписывания страниц, потому что все обращения к серверу
   идут только через функции из src/lib/api/. */

// Базовый адрес API без хвостового слэша. Пусто — бэкенд ещё не подключён.
const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

/** Подключён ли бэкенд (задан ли VITE_API_URL). */
export function apiConfigured(): boolean {
  return API_BASE !== ''
}

/** Полный URL к эндпоинту API (для редиректов, напр. OAuth). '' если бэк не подключён. */
export function apiUrl(path: string): string {
  return API_BASE ? `${API_BASE}${path}` : ''
}

/* Ошибка обращения к серверу. status === 0 — сети не было (бэк не подключён
   или сервер недоступен); status === 401 — пользователь не авторизован. */
export class ApiError extends Error {
  status: number
  data: unknown
  constructor(status: number, message: string, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

/** Человеческий текст ошибки для тостов. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return 'Что-то пошло не так'
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  /** Объект → отправится как JSON. FormData → отправится как есть (файлы). */
  body?: unknown
  signal?: AbortSignal
}

/* Единая обёртка над fetch: подставляет базовый адрес, шлёт/принимает JSON,
   передаёт куки-сессию (credentials: 'include') и приводит ошибки к ApiError. */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (!API_BASE) {
    throw new ApiError(0, 'Сервер пока не подключён')
  }

  const isForm = opts.body instanceof FormData
  const hasBody = opts.body !== undefined

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: opts.method ?? (hasBody ? 'POST' : 'GET'),
      credentials: 'include',
      headers: hasBody && !isForm ? { 'Content-Type': 'application/json' } : undefined,
      body: !hasBody ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
      signal: opts.signal,
    })
  } catch {
    // Сеть недоступна / сервер не отвечает.
    throw new ApiError(0, 'Не удалось связаться с сервером')
  }

  const text = await res.text()
  const data = text ? safeJson(text) : null

  if (!res.ok) {
    throw new ApiError(res.status, messageFrom(data, res.status), data)
  }
  return data as T
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function messageFrom(data: unknown, status: number): string {
  if (data && typeof data === 'object' && 'message' in data) {
    const m = (data as { message?: unknown }).message
    if (typeof m === 'string' && m) return m
  }
  if (status === 401) return 'Нужно войти в аккаунт'
  return `Ошибка сервера (${status})`
}
