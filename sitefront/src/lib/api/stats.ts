/* Публичные показатели для главной страницы. Без авторизации. */

import { request } from './client'
import type { TotalChecksResponse } from './types'

/* Общее число проверок (публичный счётчик counters.total_checks).
   GET /api/public/total-checks — открытый маршрут, логин не нужен.
   Пока на главной странице стоит статичное число; подключим позже. */
export function getTotalChecks(): Promise<TotalChecksResponse> {
  return request<TotalChecksResponse>('/api/public/total-checks')
}
