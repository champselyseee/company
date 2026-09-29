/* Эндпоинт оплаты. Список тарифов и способов оплаты — статический конфиг
   в src/lib/billing.ts (не эндпоинт); сюда вынесено только создание платежа. */

import { request } from './client'
import type {
  CreatePaymentRequest,
  CreatePaymentResponse,
  PaymentStatusResponse,
  Purchase,
} from './types'

/* Создать платёж. POST /api/payments
   Бэкенд создаёт платёж у провайдера (ЮKassa/Telegram Stars) и возвращает
   ссылку для оплаты (confirmationUrl) и id платежа. Начисление проверок — после
   подтверждения оплаты: вебхуком ЮKassa или опросом getPaymentStatus (кто первый). */
export function createPayment(data: CreatePaymentRequest): Promise<CreatePaymentResponse> {
  return request<CreatePaymentResponse>('/api/payments', { body: data })
}

/* Статус платежа. GET /api/payments/{id}
   Пока платёж не оплачен, сервер сам спрашивает кассу и, если деньги пришли,
   сразу начисляет — фронт просто опрашивает этот адрес раз в несколько секунд. */
export function getPaymentStatus(paymentId: string): Promise<PaymentStatusResponse> {
  return request<PaymentStatusResponse>(`/api/payments/${encodeURIComponent(paymentId)}`)
}

/** Оплаченные покупки для истории в профиле (и с сайта, и из бота). GET /api/purchases */
export function getPurchases(): Promise<Purchase[]> {
  return request<Purchase[]>('/api/purchases')
}
