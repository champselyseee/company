/* Эндпоинты проверки работ, распознавания фото и истории проверок. */

import { request } from './client'
import type { CheckRequest, CheckResponse, HistoryItem, RecognizeResponse } from './types'

/* Проверить работу. POST /api/checks
   Бэкенд прогоняет текст через модель, списывает одну проверку, пишет запись
   в историю и увеличивает публичный счётчик (см. record_check в core/db.py). */
export function checkWork(data: CheckRequest): Promise<CheckResponse> {
  return request<CheckResponse>('/api/checks', { body: data })
}

/* Распознать текст с фото (рукопись/скан). POST /api/ocr
   На бэкенде — через core/grok.py. Возвращает распознанный текст. */
export function recognizeImage(file: File): Promise<RecognizeResponse> {
  const form = new FormData()
  form.append('image', file)
  return request<RecognizeResponse>('/api/ocr', { body: form })
}

/** Последние проверки пользователя. GET /api/history?limit= */
export function getHistory(limit = 5): Promise<HistoryItem[]> {
  return request<HistoryItem[]>(`/api/history?limit=${limit}`)
}
