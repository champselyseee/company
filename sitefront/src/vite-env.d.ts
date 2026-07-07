/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Базовый адрес бэкенда сайта (siteback). Пустой — бэк ещё не подключён. */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
