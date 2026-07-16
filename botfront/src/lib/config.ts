// Адрес бэкенда бота (botback на Railway) — веб-сервер мини-аппы.
// Задаётся переменной сборки VITE_BACKEND_URL (Vercel env). Без хвостовых слешей.
// В проде ОБЯЗАТЕЛЬНО задать — иначе запросы пойдут на тот же хост, что и фронт.
export const BACKEND_URL: string =
  (import.meta.env.VITE_BACKEND_URL as string | undefined)?.replace(/\/+$/, '') || ''

// Лимиты, согласованные с бэкендом.
export const MAX_FILE_BYTES = 8 * 1024 * 1024 // 8 МБ
export const MAX_PHOTOS = 2
export const MIN_TEXT_LENGTH = 50
export const IMAGE_MAX_SIDE = 1200
export const IMAGE_JPEG_QUALITY = 0.82
