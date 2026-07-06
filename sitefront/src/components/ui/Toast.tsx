import { AnimatePresence, motion } from 'motion/react'
import { IconCheck, IconClose, IconSparkles } from '../../lib/icons'
import styles from './Toast.module.css'

export type ToastKind = 'success' | 'error' | 'info'
export interface ToastItem {
  id: number
  text: string
  kind: ToastKind
}

const ICONS = {
  success: IconCheck,
  error: IconClose,
  info: IconSparkles,
}

export function ToastHost({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[]
  onDismiss: (id: number) => void
}) {
  return (
    <div className={styles.host} role="region" aria-live="polite" aria-label="Уведомления">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = ICONS[t.kind]
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95, transition: { duration: 0.18 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className={`${styles.toast} ${styles[t.kind]}`}
            >
              <span className={styles.icon}>
                <Icon size={18} />
              </span>
              <span className={styles.text}>{t.text}</span>
              <button
                className={styles.close}
                onClick={() => onDismiss(t.id)}
                aria-label="Закрыть уведомление"
              >
                <IconClose size={16} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
