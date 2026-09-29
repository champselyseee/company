import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from './api'
import {
  PENDING_TTL_MS,
  clearPendingPayment,
  loadPendingPayment,
  type PendingPayment,
} from './pendingPayment'

/* Слежение за платежом после возврата со страницы ЮKassa.

   Если перед уходом на оплату был запомнен платёж (lib/pendingPayment.ts), спрашиваем сервер
   о его статусе: первые 3 минуты — каждые 4 с, потом раз в 15 с (до 30 мин). Сервер сам
   переспрашивает кассу и начисляет. Оплачено → onCredited (анимация + уведомление);
   отменён → фаза «canceled». Фазы управляют плашкой PaymentBanner. */

export type PaymentPhase = 'idle' | 'waiting' | 'slow' | 'canceled'

export interface Credit {
  /** Баланс до оплаты. */
  from: number
  /** Баланс после зачисления. */
  to: number
  /** Что куплено, напр. «5 проверок». */
  title: string
}

const SLOW_AFTER_MS = 3 * 60 * 1000
const FAST_POLL_MS = 4000
const SLOW_POLL_MS = 15000

export function usePaymentWatcher(enabled: boolean, onCredited: (c: Credit) => void) {
  const [pending, setPending] = useState<PendingPayment | null>(null)
  const [phase, setPhase] = useState<PaymentPhase>('idle')
  // «Скрыть» прячет плашку, но слежение продолжается — зачисление всё равно покажем.
  const [hidden, setHidden] = useState(false)
  const onCreditedRef = useRef(onCredited)
  onCreditedRef.current = onCredited

  // Вошли — проверяем, не ждём ли мы платёж. Вышли — всё сворачиваем.
  useEffect(() => {
    if (!enabled) {
      setPending(null)
      setPhase('idle')
      return
    }
    const p = loadPendingPayment()
    if (p) {
      setPending(p)
      setHidden(false)
      setPhase(Date.now() - p.startedAt > SLOW_AFTER_MS ? 'slow' : 'waiting')
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || !pending) return
    const p = pending
    let alive = true
    let timer = 0

    function stop(next: PaymentPhase, forget = true) {
      if (forget) clearPendingPayment()
      setPending(null)
      setPhase(next)
    }

    async function tick() {
      try {
        const res = await api.billing.getPaymentStatus(p.paymentId)
        if (!alive) return
        if (res.status === 'succeeded') {
          stop('idle')
          onCreditedRef.current({ from: p.balanceBefore, to: res.balance, title: res.title })
          return
        }
        if (res.status === 'canceled') {
          setHidden(false)
          stop('canceled')
          return
        }
      } catch (e) {
        if (!alive) return
        if (e instanceof ApiError && e.status === 404) return stop('idle') // платёж не найден
        if (e instanceof ApiError && e.status === 401) return stop('idle', false) // сессия кончилась
        // сеть/сервер — просто пробуем ещё раз по расписанию
      }
      const elapsed = Date.now() - p.startedAt
      if (elapsed > PENDING_TTL_MS) {
        // Дольше 30 минут не ждём: плашку «долго» оставляем, пока её не скроют.
        clearPendingPayment()
        setPending(null)
        return
      }
      if (elapsed > SLOW_AFTER_MS) setPhase((ph) => (ph === 'waiting' ? 'slow' : ph))
      timer = window.setTimeout(tick, elapsed > SLOW_AFTER_MS ? SLOW_POLL_MS : FAST_POLL_MS)
    }

    void tick()
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [enabled, pending])

  const dismiss = useCallback(() => {
    setHidden(true)
    // Отменённый платёж больше не ждём — плашку можно убрать совсем.
    setPhase((ph) => (ph === 'canceled' ? 'idle' : ph))
  }, [])

  return { phase: hidden ? ('idle' as const) : phase, dismiss }
}
