import { BACKEND_URL } from './config'
import type {
  AttachedFile,
  CheckTokenResponse,
  OcrResponse,
  ProxyResponse,
  StatsResponse,
  WorkType,
} from './types'

export interface StatsData {
  /** Общий счётчик проверок (или null, если бэк не отдал). */
  total: number | null
  /** Личный счётчик пользователя (или null, если бэк не отдал). */
  mine: number | null
}

/**
 * Статистика для счётчиков на форме: общий счётчик + личный.
 * Эндпоинт бэкенда: GET /stats?token=... → { total_checks, user_checks }.
 * Если бэк ещё не поддерживает статистику или недоступен — тихо возвращаем
 * null'ы, а фронт покажет витринный фолбэк (счётчик не ломает форму).
 */
export async function fetchStats(token: string, signal?: AbortSignal): Promise<StatsData> {
  try {
    const url = token
      ? `${BACKEND_URL}/stats?token=${encodeURIComponent(token)}`
      : `${BACKEND_URL}/stats`
    const res = await fetch(url, { signal })
    if (!res.ok) return { total: null, mine: null }
    const data = (await res.json()) as StatsResponse
    return {
      total: typeof data.total_checks === 'number' ? data.total_checks : null,
      mine: typeof data.user_checks === 'number' ? data.user_checks : null,
    }
  } catch {
    return { total: null, mine: null }
  }
}

/** Проверка токена при старте. Возвращает true, если токен валиден. */
export async function checkToken(token: string, signal?: AbortSignal): Promise<boolean> {
  const res = await fetch(`${BACKEND_URL}/check_token?token=${encodeURIComponent(token)}`, {
    signal,
  })
  const data = (await res.json()) as CheckTokenResponse
  return Boolean(data.ok)
}

export interface ProxyPayload {
  token: string
  type: WorkType
  text: string
  photos: string[]
  file: AttachedFile | null
}

/**
 * Основная проверка работы. Сжигает токен на бэкенде.
 *
 * Запрашивает потоковый ответ (`stream: true`): проверка длится 1–3 минуты, и
 * без потока соединение в Telegram WebView рвалось с ошибкой «load failed».
 * Бэк шлёт построчный JSON (NDJSON): `{"type":"ping"}` — «пульс» для удержания
 * связи, `{"type":"done","answer":...}` — результат, `{"type":"error",...}` —
 * ошибка. Старый бэк (без потока) отвечает одним JSON — этот случай тоже
 * поддерживается ради безопасного поэтапного деплоя.
 *
 * Бросает Error с текстом из поля `error` бэкенда либо `HTTP <status>`.
 */
export async function submitProxy(payload: ProxyPayload): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, stream: true }),
  })

  // Ранние ошибки бэка (плохой токен, пустая работа и т.п.) приходят обычным
  // JSON с кодом 4xx — до начала потока.
  if (!res.ok) {
    const data: ProxyResponse = await res.json().catch(() => ({}))
    throw new Error(data.error || `HTTP ${res.status}`)
  }

  // Старый бэк без стриминга отвечает одним JSON — поддерживаем совместимость.
  const ctype = res.headers.get('content-type') || ''
  if (!res.body || !ctype.includes('ndjson')) {
    const data: ProxyResponse = await res.json().catch(() => ({}))
    if (data.error) throw new Error(data.error)
    return data.answer ?? ''
  }

  // Новый бэк: читаем поток построчно. «Пульсы» игнорируем, ждём done/error.
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let answer = ''
  let gotDone = false
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let nl = buf.indexOf('\n')
    while (nl >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      nl = buf.indexOf('\n')
      if (!line) continue
      let msg: { type?: string; answer?: string; error?: string }
      try {
        msg = JSON.parse(line)
      } catch {
        continue // неполная/битая строка — пропускаем
      }
      if (msg.type === 'ping') continue
      if (msg.type === 'error') throw new Error(msg.error || 'Ошибка проверки')
      if (msg.type === 'done') {
        answer = msg.answer ?? ''
        gotDone = true
      }
    }
  }
  if (!gotDone) {
    throw new Error('Соединение прервалось до получения результата')
  }
  return answer
}

/**
 * OCR одного фото рукописи. Токен проверяется, но НЕ сжигается.
 * Бросает Error с человекочитаемым текстом при неудаче.
 */
export async function recognizePhoto(token: string, photo: string): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/ocr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, photo }),
  })
  const data: OcrResponse = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return (data.text ?? '').trim()
}
