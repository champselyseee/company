// Тонкая типизированная обёртка над Telegram WebApp SDK.
// В обычном браузере (dev без Telegram) подставляется безопасная заглушка,
// чтобы приложение не падало и его можно было отлаживать локально.

type HapticStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
type HapticNotification = 'error' | 'success' | 'warning'

interface ThemeParams {
  bg_color?: string
  text_color?: string
  hint_color?: string
  link_color?: string
  button_color?: string
  button_text_color?: string
  secondary_bg_color?: string
}

interface TelegramWebApp {
  initData: string
  colorScheme: 'light' | 'dark'
  themeParams: ThemeParams
  isExpanded: boolean
  expand: () => void
  close: () => void
  ready: () => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  MainButton: {
    show: () => void
    hide: () => void
  }
  HapticFeedback?: {
    impactOccurred: (style: HapticStyle) => void
    notificationOccurred: (type: HapticNotification) => void
    selectionChanged: () => void
  }
  /** Bot API 7.7+: запрещает свайп-вниз, закрывающий/дёргающий WebApp. */
  disableVerticalSwipes?: () => void
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

function createStub(): TelegramWebApp {
  return {
    initData: '',
    colorScheme: 'light',
    themeParams: {},
    isExpanded: true,
    expand: () => {},
    close: () => {},
    ready: () => {},
    MainButton: { show: () => {}, hide: () => {} },
  }
}

export const tg: TelegramWebApp = window.Telegram?.WebApp ?? createStub()

/** Запущено ли приложение реально внутри Telegram. */
export const isTelegram = Boolean(window.Telegram?.WebApp)

export function haptic(style: HapticStyle): void {
  tg.HapticFeedback?.impactOccurred(style)
}

export function notify(type: HapticNotification): void {
  tg.HapticFeedback?.notificationOccurred(type)
}

/** Цвет «бумаги» концепции — держим фиксированную тему независимо от темы Telegram. */
const PAPER = '#f4ebda'

/** Инициализация: разворачиваем окно, прячем системную кнопку, фиксируем фон. */
export function initTelegram(): void {
  try {
    tg.ready()
    tg.expand()
    tg.disableVerticalSwipes?.() // свайп-вниз не закрывает/не дёргает окно (Bot API 7.7+)
    tg.MainButton.hide()
    document.body.style.backgroundColor = PAPER
    tg.setHeaderColor?.(PAPER)
    tg.setBackgroundColor?.(PAPER)
  } catch {
    // вне Telegram — игнорируем
  }

  // Надёжный блок pinch-zoom на iOS (где user-scalable=no часто игнорируется):
  // гасим системные жесты масштабирования и double-tap-zoom.
  const stop = (e: Event) => e.preventDefault()
  document.addEventListener('gesturestart', stop, { passive: false })
  document.addEventListener('gesturechange', stop, { passive: false })
  document.addEventListener('gestureend', stop, { passive: false })
  let lastTouchEnd = 0
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now()
      if (now - lastTouchEnd <= 300) e.preventDefault() // double-tap zoom
      lastTouchEnd = now
    },
    { passive: false },
  )
}
