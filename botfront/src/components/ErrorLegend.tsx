import type { ResultSegment, ErrorType } from '../lib/types'
import { ERROR_LABELS, ERROR_ORDER } from '../lib/errorTypes'
import styles from './ErrorLegend.module.css'

/** Легенда «Типы ошибок:» — показывает только те типы, что реально встретились. */
export function ErrorLegend({ segments }: { segments: ResultSegment[] }) {
  const present = new Set<ErrorType>(segments.map((s) => s.e))
  const types = ERROR_ORDER.filter((t) => present.has(t))
  if (types.length === 0) return null
  return (
    <div className={styles.legend}>
      <span className={styles.label}>Типы ошибок:</span>
      {types.map((t) => (
        <span key={t} className={`${styles.chip} ${styles[t]}`}>
          {ERROR_LABELS[t]}
        </span>
      ))}
    </div>
  )
}
