/* Баланс с прошлого открытия мини-аппы — чтобы показать зачисление (как на сайте):
   если с тех пор проверок стало больше (оплата, бонус за друга), «Осталось проверок»
   докручивается от старого числа к новому.

   Храним в localStorage webview Telegram, отдельно для каждого Telegram-аккаунта.
   Хранилище может быть недоступно — тогда просто без анимации. */

import { tg } from './telegram'

function key(): string {
  let id = 'dev'
  try {
    const user = new URLSearchParams(tg.initData).get('user')
    if (user) id = String(JSON.parse(user).id ?? 'dev')
  } catch {
    /* initData без user — общий ключ */
  }
  return `ege_bot_last_balance_${id}`
}

export function loadLastBalance(): number | null {
  try {
    const raw = localStorage.getItem(key())
    const n = raw === null ? NaN : Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

export function saveLastBalance(n: number): void {
  try {
    localStorage.setItem(key(), String(n))
  } catch {
    /* хранилище недоступно — обойдёмся без анимации */
  }
}
