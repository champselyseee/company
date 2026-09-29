import { AnimatePresence, motion } from 'motion/react'
import { Button } from './ui/Button'
import { IconArrowRight, IconClock, IconClose } from '../lib/icons'
import type { PaymentPhase } from '../lib/usePaymentWatcher'
import styles from './PaymentBanner.module.css'

const COPY: Record<Exclude<PaymentPhase, 'idle'>, { title: string; text: string }> = {
  waiting: {
    title: 'Платёж обрабатывается',
    text: 'В течение 3 минут проверки зачислятся на баланс. Обновлять страницу не нужно — мы сразу покажем, когда всё придёт.',
  },
  slow: {
    title: 'Касса ещё не подтвердила оплату',
    text: 'Если вы оплатили — проверки придут автоматически, как только касса ответит. Если не завершили оплату — выберите тариф ещё раз.',
  },
  canceled: {
    title: 'Оплата не прошла',
    text: 'Деньги не списаны. Можно попробовать ещё раз.',
  },
}

/* Плашка над контентом после возврата со страницы оплаты. Видна на любой вкладке,
   пока идёт ожидание (фазы — из usePaymentWatcher). */
export function PaymentBanner({
  phase,
  onDismiss,
  onPricing,
}: {
  phase: PaymentPhase
  onDismiss: () => void
  onPricing: () => void
}) {
  return (
    <div className="container" role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {phase !== 'idle' && (
          <motion.div
            key={phase}
            className={`${styles.banner} ${styles[phase]}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            <span className={styles.icon} aria-hidden="true">
              {phase === 'waiting' ? (
                <span className={styles.spinner} />
              ) : phase === 'slow' ? (
                <IconClock size={20} />
              ) : (
                <IconClose size={20} />
              )}
            </span>
            <div className={styles.body}>
              <b className={styles.title}>{COPY[phase].title}</b>
              <span className={styles.text}>{COPY[phase].text}</span>
            </div>
            {phase !== 'waiting' && (
              <div className={styles.actions}>
                {phase === 'canceled' && (
                  <Button onClick={onPricing} trailing={<IconArrowRight size={16} />}>
                    К тарифам
                  </Button>
                )}
                <Button variant="ghost" onClick={onDismiss}>
                  Скрыть
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
