/* Эндпоинты авторизации. Все обращения идут через общий request() из client.ts. */

import { request, apiUrl, apiConfigured } from './client'
import type { AuthResponse, LoginRequest, RegisterRequest, User } from './types'

/** Регистрация по email. POST /api/auth/register */
export function register(data: RegisterRequest): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/register', { body: data })
}

/** Вход по email. POST /api/auth/login */
export function login(data: LoginRequest): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/login', { body: data })
}

/** Выход. POST /api/auth/logout */
export function logout(): Promise<void> {
  return request<void>('/api/auth/logout', { method: 'POST' })
}

/** Текущий пользователь по куки-сессии. GET /api/me (401 — не авторизован). */
export function me(): Promise<User> {
  return request<User>('/api/me')
}

/** Запрос восстановления пароля. POST /api/auth/forgot */
export function forgotPassword(email: string): Promise<void> {
  return request<void>('/api/auth/forgot', { body: { email } })
}

// Провайдеры входа через сторонние сервисы.
export type OAuthProvider = 'google' | 'telegram'

/* Начать вход через Google/Telegram: уводим пользователя на бэкенд, который
   сам разберётся с провайдером и вернёт обратно с установленной сессией.
   Возвращает false, если бэкенд ещё не подключён (тогда редиректа не будет). */
export function startOAuth(provider: OAuthProvider): boolean {
  if (!apiConfigured()) return false
  window.location.href = apiUrl(`/api/auth/${provider}/start`)
  return true
}
