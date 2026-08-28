import { BACKEND_URL } from './config'
import { tg } from './telegram'
import type { AttachedFile, OcrResponse, ProxyResponse, WorkType } from './types'

/** Заголовки авторизации мини-аппы: Telegram initData в схеме 'tma'. */
function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return { Authorization: `tma ${tg.initData}`, ...(extra ?? {}) }
}

export interface MeData {
  /** Сколько проверок доступно прямо сейчас (подписка + бесплатная + оплаченные). */
  checksLeft: number | null
  /** Публичный счётчик «работ проверено». */
  totalChecks: number | null
}

/**
 * Кто я и сколько проверок осталось. Зовёт GET /api/me (с initData).
 * При ошибке/401/обрыве — null'ы: форма просто не покажет остаток, но не сломается.
 */
export async function fetchMe(signal?: AbortSignal): Promise<MeData> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/me`, { headers: authHeaders(), signal })
    if (!res.ok) return { checksLeft: null, totalChecks: null }
    const data = await res.json()
    return {
      checksLeft: typeof data.checksLeft === 'number' ? data.checksLeft : null,
      totalChecks: typeof data.totalChecks === 'number' ? data.totalChecks : null,
    }
  } catch {
    return { checksLeft: null, totalChecks: null }
  }
}

export interface ProxyPayload {
  type: WorkType
  text: string
  photos: string[]
  file: AttachedFile | null
}

/**
 * Основная проверка работы (POST /api/check). Авторизация — по Telegram initData.
 * Списание проверки делает бэкенд В МОМЕНТ проверки. Бросает Error с кодом/текстом ошибки.
 */
export async function submitProxy(payload: ProxyPayload): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/api/check`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      type: payload.type,
      text: payload.text,
      photos: payload.photos,
      file: payload.file,
    }),
  })
  const data: ProxyResponse = await res.json().catch(() => ({}))
  if (!res.ok || data.error) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return data.answer ?? ''
}

/**
 * OCR одного фото рукописи (POST /api/ocr). Проверку не списывает.
 */
export async function recognizePhoto(photo: string): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/api/ocr`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ photo }),
  })
  const data: OcrResponse = await res.json().catch(() => ({}))
  if (!res.ok || data.error) {
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return (data.text ?? '').trim()
}
