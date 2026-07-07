/* Эндпоинт оплаты. Список тарифов и способов оплаты — статический конфиг
   в src/lib/billing.ts (не эндпоинт); сюда вынесено только создание платежа. */

import { request } from './client'
import type { CreatePaymentRequest, CreatePaymentResponse } from './types'

/* Создать платёж. POST /api/payments
   Бэкенд создаёт платёж у провайдера (ЮKassa/Telegram Stars) и возвращает
   ссылку для оплаты (confirmationUrl). Начисление проверок — после
   подтверждения оплаты вебхуком (mark_payment_processed в core/db.py). */
export function createPayment(data: CreatePaymentRequest): Promise<CreatePaymentResponse> {
  return request<CreatePaymentResponse>('/api/payments', { body: data })
}
