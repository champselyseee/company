/* Эндпоинт анкеты отзыва о проверке (всплывающее окно после проверки). */

import { request } from './client'
import type { FeedbackRequest } from './types'

/** Отправить анкету по проверке checkId. POST /api/feedback */
export function sendFeedback(data: FeedbackRequest): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/feedback', { body: data })
}
