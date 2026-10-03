/* Баланс с прошлого открытия мини-аппы — чтобы показать зачисление (как на сайте).

   «Баланс пополнен» — только если проверок стало больше И с прошлого раза была новая оплата
   (сервер отдаёт дату последней покупки) или рост в том же месяце (бонус за друга). Рост на
   стыке месяцев без покупки — это обновилась месячная норма подписки, не пополнение.

   Храним в localStorage webview Telegram, отдельно для каждого Telegram-аккаунта.
   Хранилище может быть недоступно — тогда просто без анимации. */

import { tg } from './telegram'

export interface BalanceSnapshot {
  balance: number
  /** Месяц 'YYYY-MM' по UTC — как метка месяца нормы подписки на сервере. null — неизвестно. */
  month: string | null
  /** Дата последней оплаты (ISO) на тот момент. */
  purchaseAt: string | null
}

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

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

export function loadLastBalance(): BalanceSnapshot | null {
  try {
    const raw = localStorage.getItem(key())
    if (raw === null) return null
    const data = JSON.parse(raw) as unknown
    // Старый формат — просто число: месяц и покупка неизвестны.
    if (typeof data === 'number') return { balance: data, month: null, purchaseAt: null }
    const s = data as Partial<BalanceSnapshot>
    if (typeof s.balance !== 'number') return null
    return {
      balance: s.balance,
      month: typeof s.month === 'string' ? s.month : null,
      purchaseAt: typeof s.purchaseAt === 'string' ? s.purchaseAt : null,
    }
  } catch {
    return null
  }
}

export function saveLastBalance(s: BalanceSnapshot): void {
  try {
    localStorage.setItem(key(), JSON.stringify(s))
  } catch {
    /* хранилище недоступно — обойдёмся без анимации */
  }
}

/** Пополнение с прошлого открытия: баланс вырос и (новая оплата или тот же месяц). */
export function isCredit(prev: BalanceSnapshot | null, balance: number, purchaseAt: string | null): boolean {
  if (!prev || balance <= prev.balance || prev.month === null) return false
  const newPurchase = purchaseAt !== null && purchaseAt !== prev.purchaseAt
  return newPurchase || prev.month === currentMonth()
}
