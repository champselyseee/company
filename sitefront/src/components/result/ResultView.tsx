import { motion } from 'motion/react'
import { useCountUp } from '../../lib/useCountUp'
import { WORK_TYPES, type WorkType } from '../../lib/workTypes'
import { DEMO_RESULTS } from '../../lib/demo'
import type { StructuredResult } from '../../lib/result'
import { HighlightedText } from './HighlightedText'
import { ErrorLegend } from './ErrorLegend'
import { CriteriaCard } from './CriteriaCard'
import styles from './ResultView.module.css'

// Цвет «героя» с баллом по доле набранного: зелёный → индиго → коралл.
function heroColor(pct: number): string {
  if (pct >= 0.85) return 'var(--green)'
  if (pct >= 0.6) return 'var(--indigo)'
  return 'var(--coral)'
}

// Изолированный счётчик балла: ре-рендерится только число, не весь разбор.
function ScoreCounter({ target, max }: { target: number; max: number }) {
  const value = useCountUp(target, 800)
  return (
    <div className={styles.heroNum}>
      {value}
      <span className={styles.heroMax}>/{max}</span>
    </div>
  )
}

/* Экран разбора (как в боте): крупный балл → легенда → текст с подсветкой →
   карточки критериев → итог и рекомендации.
   Если передан `result` — показываем реальный разбор с сервера; иначе берём
   готовый пример из DEMO_RESULTS[type] (витрина «Посмотреть пример»). */
export function ResultView({ type, result }: { type: WorkType; result?: StructuredResult }) {
  const data = result ?? DEMO_RESULTS[type]
  const resultLabel = WORK_TYPES[type].resultLabel
  const heroStyle =
    data.max_score > 0 ? { background: heroColor(data.score / data.max_score) } : undefined

  return (
    <motion.div
      className={styles.wrap}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {data.task ? (
        <div className={styles.task}>
          <div className={styles.taskHead}>
            <span className={styles.taskLabel}>{data.task.label ?? 'Задание'}</span>
            {data.task.from || data.task.subject ? (
              <span className={styles.taskMeta}>
                {data.task.from ? `From: ${data.task.from}` : ''}
                {data.task.from && data.task.subject ? ' · ' : ''}
                {data.task.subject ? `Subject: ${data.task.subject}` : ''}
              </span>
            ) : null}
          </div>
          <div className={styles.taskBody}>{data.task.text}</div>
        </div>
      ) : null}

      <div className={styles.hero} style={heroStyle}>
        <div className={styles.heroLabel}>Итоговый балл</div>
        <ScoreCounter target={data.score} max={data.max_score} />
        <div className={styles.heroType}>{resultLabel}</div>
      </div>

      <ErrorLegend segments={data.segments} />

      {data.segments.length > 0 && <HighlightedText segments={data.segments} />}

      {data.criteria.length > 0 && (
        <div className={styles.criteriaList}>
          {data.criteria.map((c, i) => (
            <CriteriaCard key={`${c.code}-${i}`} c={c} index={i} />
          ))}
        </div>
      )}

      {data.summary ? (
        <div className={`${styles.section} ${styles.good}`}>
          <div className={styles.sectionTitle}>Итог и рекомендации</div>
          <div className={styles.sectionBody}>{data.summary}</div>
        </div>
      ) : null}
    </motion.div>
  )
}
