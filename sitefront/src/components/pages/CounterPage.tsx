import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import {
  countdownParts,
  formatExamDate,
  formatWeekday,
  orderedExamViews,
  pluralDays,
} from '../../lib/examDates'
import { useCountUp } from '../../lib/useCountUp'
import { EXAM_SCALES, chunkRows } from '../../lib/examScales'
import {
  IconArrowRight,
  IconCalendar,
  IconClock,
  IconTarget,
} from '../../lib/icons'
import styles from './CounterPage.module.css'

/* Сколько строк в одной колонке таблицы перевода (длинную шкалу режем на столбцы). */
const ROWS_PER_COLUMN = 14

/* Горизонт прогресс-полосы: считаем, какую часть «последних 120 дней» уже прошли. */
const HORIZON_DAYS = 120

export function CounterPage() {
  const reduce = useReducedMotion()
  // Тикаем раз в секунду, чтобы часы/минуты/секунды шли вживую.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  // Один переключатель управляет всей страницей: и отсчётом, и таблицей баллов.
  const [subjectId, setSubjectId] = useState(EXAM_SCALES[0].id)
  const scale = EXAM_SCALES.find((s) => s.id === subjectId) ?? EXAM_SCALES[0]
  const columns = chunkRows(scale.rows, ROWS_PER_COLUMN)

  // Отсчёт до экзамена выбранного предмета.
  const views = orderedExamViews(now)
  const current = views.find((v) => v.exam.id === subjectId) ?? views[0]
  const parts = countdownParts(current.date, now)
  const bigDays = useCountUp(parts.days, 900)

  const progress = Math.max(0, Math.min(1, 1 - parts.days / HORIZON_DAYS))

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.head}>
        <span className={styles.eyebrow}>
          <IconCalendar size={15} /> Счётчик до ЕГЭ
        </span>
        <h1 className={styles.h1}>Экзамен: отсчёт и баллы</h1>
        <p className={styles.lead}>
          Выбери предмет — покажем отсчёт до его экзамена и таблицу перевода
          первичных баллов в тестовые.
        </p>
      </div>

      {/* Главный переключатель предметов — управляет всей страницей */}
      <div className={styles.segmented} role="group" aria-label="Предмет">
        {EXAM_SCALES.map((s) => {
          const active = s.id === subjectId
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={active}
              className={`${styles.segBtn} ${active ? styles.segActive : ''}`}
              onClick={() => setSubjectId(s.id)}
            >
              {s.short}
            </button>
          )
        })}
      </div>

      {/* Большой счётчик выбранного экзамена */}
      <motion.div
        key={subjectId}
        className={styles.bigCard}
        initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
      >
        <div className={styles.bigTop}>
          <span className={styles.nearestTag}>
            <IconTarget size={15} /> Экзамен
          </span>
          <span className={styles.bigSubject}>{current.exam.subject}</span>
        </div>

        <div className={styles.bigNumberWrap}>
          <span className={styles.bigNumber}>{bigDays}</span>
          <span className={styles.bigUnit}>{pluralDays(parts.days)}</span>
        </div>

        <div className={styles.bigDate}>
          <IconCalendar size={17} />
          <span>
            {formatWeekday(current.date)}, {formatExamDate(current.date)}
          </span>
        </div>

        {/* Живые часы/минуты/секунды */}
        <div className={styles.clock}>
          <ClockTile value={parts.hours} label="часов" />
          <span className={styles.colon}>:</span>
          <ClockTile value={parts.minutes} label="минут" />
          <span className={styles.colon}>:</span>
          <ClockTile value={parts.seconds} label="секунд" />
        </div>

        <div className={styles.progress} aria-hidden="true">
          <motion.span
            className={styles.progressFill}
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <p className={styles.progressNote}>
          <IconClock size={14} /> Финишная прямая ближе, чем кажется
        </p>
      </motion.div>

      {/* Видимая граница между блоком отсчёта и разбалловкой */}
      <hr className={styles.divider} />

      {/* Разбалловка: перевод первичных баллов в тестовые (100-балльные) */}
      <section className={styles.scales} aria-labelledby="scales-title">
        <h2 className={styles.h2} id="scales-title">
          Разбалловка ЕГЭ
        </h2>
        <p className={styles.scalesLead}>
          {scale.subject}: перевод первичных баллов в тестовые (по 100-балльной
          шкале). Найди свой первичный балл слева — рядом тестовый.
        </p>

        <p className={styles.scaleMeta}>
          <IconArrowRight size={14} /> Первичный → тестовый (
          {scale.maxPrimaryScore} → {scale.maxTestScore})
        </p>

        <motion.div
          key={subjectId}
          className={styles.scaleGrid}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          {columns.map((col, ci) => (
            <table key={ci} className={styles.scaleTable}>
              <thead>
                <tr>
                  <th scope="col">Перв.</th>
                  <th scope="col">Тест</th>
                </tr>
              </thead>
              <tbody>
                {col.map((row) => {
                  const isMax = row.test === scale.maxTestScore
                  // Подсвечиваем диапазон первичных баллов от 1 до scale.highlightTo.
                  const isHighlight = row.primary <= scale.highlightTo
                  const rowClass = isMax
                    ? styles.maxRow
                    : isHighlight
                      ? styles.highlightRow
                      : ''
                  return (
                    <tr key={row.primary} className={rowClass}>
                      <td>{row.primary}</td>
                      <td className={styles.testCell}>{row.test}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ))}
        </motion.div>
      </section>
    </div>
  )
}

function ClockTile({ value, label }: { value: number; label: string }) {
  return (
    <span className={styles.clockTile}>
      <span className={styles.clockNum}>{String(value).padStart(2, '0')}</span>
      <span className={styles.clockLabel}>{label}</span>
    </span>
  )
}
