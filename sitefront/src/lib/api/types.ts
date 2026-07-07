/* Типы запросов и ответов API. Здесь только «форма» данных, которыми фронт
   обменивается с бэкендом. Переиспользуем уже существующие типы фронта:
   StructuredResult (формат разбора) и WorkType (тип работы). */

import type { StructuredResult } from '../result'
import type { WorkType } from '../workTypes'

/* ── Пользователь и авторизация ── */

// Пользователь в том виде, в каком он нужен интерфейсу. Собирается бэкендом
// из таблицы users (см. core/schema.sql): баланс = оплаченные проверки +
// бесплатная (если не израсходована) + активная подписка.
export interface User {
  id: number
  displayName: string | null
  email: string | null
  /** Название тарифа для показа (напр. «Бесплатный», «Семестр»). */
  plan: string
  /** Сколько проверок доступно прямо сейчас. */
  balance: number
  /** Дата регистрации (ISO-строка), напр. «2026-03-01». */
  joinedAt: string | null
}

export interface AuthResponse {
  user: User
}

export interface RegisterRequest {
  email: string
  password: string
  name: string
}

export interface LoginRequest {
  email: string
  password: string
}

/* ── История и проверка ── */

export interface HistoryItem {
  id: number
  workType: WorkType
  /** Заголовок для списка (напр. «Английское эссе»). */
  title: string
  score: number
  maxScore: number
  /** Когда проверено (ISO-строка). */
  createdAt: string
}

export interface CheckRequest {
  workType: WorkType
  /** Текст задания (опционально: например, распознанный с фото). */
  taskText?: string
  /** Текст работы ученика — обязателен. */
  studentText: string
}

export interface CheckResponse {
  result: StructuredResult
  /** Остаток проверок после списания. */
  balance: number
}

export interface RecognizeResponse {
  /** Распознанный с фото текст. */
  text: string
}

/* ── Профиль ── */

export interface ProfileStats {
  /** Сколько работ проверено всего. */
  worksChecked: number
  /** Средний процент за работы (0–100), null — пока нет данных. */
  averagePercent: number | null
  /** Серия дней подряд с проверками. */
  streakDays: number
  /** Лучший результат в виде «21/22», null — пока нет данных. */
  bestScore: string | null
}

export interface ProfileResponse {
  stats: ProfileStats
  /** id разблокированных достижений (см. ACHIEVEMENTS в lib/profile.ts). */
  unlockedAchievements: string[]
}

/* ── Оплата ── */

// Совпадает с processed_payments.provider в схеме БД.
export type PaymentMethodId = 'yookassa' | 'stars'

export interface CreatePaymentRequest {
  /** Пакет проверок или подписка. */
  kind: 'package' | 'plan'
  /** id выбранного пакета/тарифа из lib/billing.ts. */
  id: string
  method: PaymentMethodId
  promo?: string
}

export interface CreatePaymentResponse {
  /** Куда отправить пользователя для оплаты. Нет — оплата уже прошла. */
  confirmationUrl?: string
  status: 'pending' | 'paid'
}

/* ── Публичный счётчик ── */

export interface TotalChecksResponse {
  totalChecks: number
}
