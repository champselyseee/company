// Адрес Railway-сервиса. Переопределяется переменной окружения VITE_BACKEND_URL
// при сборке (см. .env.example). Дефолт — бэкенд зеркала (backendmirrr).
export const BACKEND_URL: string =
  (import.meta.env.VITE_BACKEND_URL as string | undefined)?.replace(/\/+$/, '') ||
  'https://backendmirrr-production.up.railway.app'

// Токен из query-параметра ?token=... (выдаётся ботом при открытии WebApp).
export const URL_TOKEN: string =
  new URLSearchParams(window.location.search).get('token') || ''

// Лимиты, согласованные с бэкендом (bot.py).
export const MAX_FILE_BYTES = 8 * 1024 * 1024 // 8 МБ
export const MAX_PHOTOS = 2
export const MIN_TEXT_LENGTH = 50
export const IMAGE_MAX_SIDE = 1200
export const IMAGE_JPEG_QUALITY = 0.82
