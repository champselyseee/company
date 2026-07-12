import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { WorkType, StructuredResult } from '../lib/types'
import { buildResultModel, parseStructured } from '../lib/parse'
import { WORK_TYPES } from '../lib/workTypes'
import { HighlightedText } from './HighlightedText'
import { ErrorLegend } from './ErrorLegend'
import { CriteriaCard } from './CriteriaCard'
import styles from './ResultView.module.css'

// Цвет по доле набранных баллов — ссылки на CSS-токены (единый источник палитры).
function heroColor(pct: number): string {
  if (pct >= 0.85) return 'var(--green)'
  if (pct >= 0.6) return 'var(--indigo)'
  return 'var(--coral)'
}

function pillColor(pct: number): string {
  if (pct >= 0.67) return 'var(--green-deep)'
  if (pct > 0) return 'var(--c-warn)'
  return 'var(--coral-deep)'
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/** Счёт от 0 до target (~700мс, easeOutCubic). Уважает prefers-reduced-motion. */
function useCountUp(target: number): number {
  const reduced = prefersReducedMotion()
  const [value, setValue] = useState(() => (reduced ? target : 0))

  useEffect(() => {
    if (reduced) {
      setValue(target)
      return
    }
    setValue(0) // всегда стартуем снизу, даже при переиспользовании инстанса
    const duration = 700
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(eased * target))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, reduced])

  return value
}

/** Изолированный счётчик балла — ре-рендерится только он, не плитки и секции. */
function ScoreCounter({ target, max }: { target: number; max: number | string }) {
  const value = useCountUp(target)
  return (
    <div className={styles.heroNum}>
      {value}
      <span className={styles.heroMax}>/{max}</span>
    </div>
  )
}

/** Новый экран: подсветка ошибок в тексте + легенда + карточки критериев. */
function StructuredResultView({ data, type }: { data: StructuredResult; type: WorkType }) {
  const resultLabel = WORK_TYPES[type].resultLabel
  const heroStyle =
    data.max_score > 0 ? { background: heroColor(data.score / data.max_score) } : undefined
  return (
    <>
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
    </>
  )
}

export function ResultView({ text, type }: { text: string; type: WorkType }) {
  const structured = useMemo(() => parseStructured(text), [text])
  // Legacy-модель считаем только если ответ не структурированный (старые записи).
  const model = useMemo(
    () => (structured ? null : buildResultModel(text, type)),
    [structured, text, type],
  )

  if (structured) return <StructuredResultView data={structured} type={type} />

  const { score, maxScore, criteria, sections, resultLabel } = model!

  const heroStyle =
    score && typeof maxScore === 'number'
      ? { background: heroColor(score.score / maxScore) }
      : undefined

  return (
    <>
      <div className={styles.hero} style={heroStyle}>
        <div className={styles.heroLabel}>Итоговый балл</div>
        {score ? (
          <ScoreCounter target={score.score} max={maxScore} />
        ) : (
          <div className={styles.heroNum}>—</div>
        )}
        <div className={styles.heroType}>{resultLabel}</div>
      </div>

      {criteria.length > 0 && (
        <div className={styles.criteriaGrid}>
          {criteria.map((c, i) => {
            const max = typeof c.max === 'number' ? c.max : null
            const color = max ? pillColor(c.score / max) : 'var(--indigo)'
            // Лёгкий разнонаправленный наклон стикеров + ступенчатый влёт.
            const tilt = (i % 2 === 0 ? -1 : 1) * (1.5 + (i % 3))
            const pillStyle = {
              '--tilt': `${tilt}deg`,
              animationDelay: `${i * 55}ms`,
            } as CSSProperties
            return (
              <div className={styles.pill} key={c.num} style={pillStyle}>
                <div className={styles.pillName}>{c.name}</div>
                <div className={styles.pillScore} style={{ color }}>
                  {c.score}
                </div>
                <div className={styles.pillMax}>из {c.max}</div>
              </div>
            )
          })}
        </div>
      )}

      <div>
        {sections.map((s, idx) => (
          <div
            className={`${styles.section} ${s.tone !== 'neutral' ? styles[s.tone] : ''}`}
            key={idx}
          >
            {s.title ? <div className={styles.sectionTitle}>{s.title}</div> : null}
            {s.body ? <div className={styles.sectionBody}>{s.body}</div> : null}
          </div>
        ))}
      </div>
    </>
  )
}
