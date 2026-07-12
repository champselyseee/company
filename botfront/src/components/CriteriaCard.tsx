import type { CSSProperties } from 'react'
import type { ResultCriterion } from '../lib/types'
import styles from './CriteriaCard.module.css'

// Цвет бейджа балла по доле набранного (как pillColor в ResultView).
function badgeColor(pct: number): string {
  if (pct >= 0.67) return 'var(--green-deep)'
  if (pct > 0) return 'var(--c-warn)'
  return 'var(--coral-deep)'
}

// Русское склонение по числу.
function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few
  return many
}

export function CriteriaCard({ c, index = 0 }: { c: ResultCriterion; index?: number }) {
  const pct = c.max > 0 ? c.score / c.max : 1
  const lost = Math.max(0, c.max - c.score)
  const style = { animationDelay: `${index * 45}ms` } as CSSProperties
  return (
    <div className={styles.card} style={style}>
      <div className={styles.head}>
        <span className={styles.code}>{c.code}</span>
        <span className={styles.badge} style={{ color: badgeColor(pct) }}>
          {c.score}/{c.max}
        </span>
      </div>
      {c.comment ? <div className={styles.comment}>{c.comment}</div> : null}
      {lost > 0 ? (
        <div className={styles.penalty}>
          {c.errors > 0
            ? `${c.errors} ${plural(c.errors, 'ошибка', 'ошибки', 'ошибок')} · `
            : ''}
          −{lost} {plural(lost, 'балл', 'балла', 'баллов')}
        </div>
      ) : null}
    </div>
  )
}
