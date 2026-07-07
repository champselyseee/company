/* Эндпоинт профиля: статистика и разблокированные достижения.
   Данные пользователя (имя, почта, баланс) приходят отдельно через auth.me(). */

import { request } from './client'
import type { ProfileResponse } from './types'

/** Статистика профиля и список разблокированных достижений. GET /api/profile */
export function getProfile(): Promise<ProfileResponse> {
  return request<ProfileResponse>('/api/profile')
}
