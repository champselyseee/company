/* Ожидающий платёж — запоминаем в браузере перед уходом на страницу ЮKassa, чтобы после
   возврата на сайт показать плашку «платёж обрабатывается» и дождаться зачисления.

   localStorage может быть недоступен (приватный режим, запрет сайта) — тогда все функции
   молча ничего не делают: сайт работает как раньше, просто без плашки. */

const KEY = 'ege_pending_payment'

/** Сколько помним платёж после ухода на оплату (с запасом на долгую оплату через банк). */
export const PENDING_TTL_MS = 60 * 60 * 1000

export interface PendingPayment {
  paymentId: string
  /** Что покупается, напр. «Пакет: 5 проверок». */
  title: string
  /** Баланс до оплаты — от него докручиваем число при зачислении. */
  balanceBefore: number
  /** Когда ушли на оплату (мс, Date.now()). */
  startedAt: number
}

export function savePendingPayment(p: PendingPayment): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* хранилище недоступно — обойдёмся без плашки */
  }
}

export function loadPendingPayment(): PendingPayment | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<PendingPayment>
    if (
      typeof p.paymentId !== 'string' ||
      typeof p.startedAt !== 'number' ||
      Date.now() - p.startedAt > PENDING_TTL_MS
    ) {
      localStorage.removeItem(KEY)
      return null
    }
    return {
      paymentId: p.paymentId,
      title: typeof p.title === 'string' ? p.title : '',
      balanceBefore: typeof p.balanceBefore === 'number' ? p.balanceBefore : 0,
      startedAt: p.startedAt,
    }
  } catch {
    return null
  }
}

export function clearPendingPayment(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* нечего чистить */
  }
}
