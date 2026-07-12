import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Telegram WebApp грузится целиком при открытии — один компактный бандл
    // удобнее для холодного старта внутри Telegram, чем множество чанков.
    chunkSizeWarningLimit: 900,
  },
})
