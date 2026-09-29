import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from './ui/Button'
import { IconClose, IconStar } from '../lib/icons'
import { api, errorMessage, type Strictness } from '../lib/api'
import type { ToastKind } from './ui/Toast'
import styles from './FeedbackModal.module.css'

const STAR_CAPTIONS = ['', 'Плохо', 'Так себе', 'Нормально', 'Хорошо', 'Отлично']

const STRICTNESS: { id: Strictness; label: string }[] = [
  { id: 'too_strict', label: 'Слишком строго' },
  { id: 'just_right', label: 'В самый раз' },
  { id: 'too_lenient', label: 'Слишком мягко' },
]

const MAX_TEXT = 2000

/* Пять звёзд: наведение подсвечивает, клик выбирает. Каждая звезда — радиокнопка
   с подписью «N из 5» для скринридера. */
function StarRating({
  value,
  onChange,
  labelledBy,
}: {
  value: number
  onChange: (n: number) => void
  labelledBy: string
}) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  return (
    <div className={styles.starsRow}>
      <div
        className={styles.stars}
        role="radiogroup"
        aria-labelledby={labelledBy}
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const on = n <= shown
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${n} из 5`}
              className={`${styles.star} ${on ? styles.starOn : ''}`}
              onClick={() => onChange(n)}
              onMouseEnter={() => setHover(n)}
            >
              <IconStar size={30} fill={on ? 'currentColor' : 'none'} />
            </button>
          )
        })}
      </div>
      <span className={styles.starCaption}>{STAR_CAPTIONS[shown]}</span>
    </div>
  )
}

/* Сама анкета (своё состояние на каждую проверку — ключ checkId у родителя). */
function FeedbackDialog({
  checkId,
  onClose,
  onToast,
}: {
  checkId: number
  onClose: () => void
  onToast: (text: string, kind?: ToastKind) => void
}) {
  const [satisfaction, setSatisfaction] = useState(0)
  const [convenience, setConvenience] = useState(0)
  const [strictness, setStrictness] = useState<Strictness | null>(null)
  const [strictnessNote, setStrictnessNote] = useState('')
  const [missing, setMissing] = useState('')
  const [sending, setSending] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const ids = useId()
  const titleId = `${ids}-title`
  const q1 = `${ids}-q1`
  const q3 = `${ids}-q3`

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Фокус — внутрь окна, Esc закрывает, страница под окном не прокручивается;
  // при закрытии фокус возвращается туда, где был. Один раз на открытие окна.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      before?.focus?.({ preventScroll: true })
    }
  }, [])

  const ready = satisfaction > 0 && convenience > 0

  async function submit() {
    if (!ready || sending) return
    setSending(true)
    try {
      await api.feedback.sendFeedback({
        checkId,
        satisfaction,
        convenience,
        strictness: strictness ?? undefined,
        strictnessNote: strictnessNote.trim() || undefined,
        missing: missing.trim() || undefined,
      })
      onToast('Спасибо за отзыв!', 'success')
      onClose()
    } catch (e) {
      onToast(errorMessage(e), 'error')
      setSending(false)
    }
  }

  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <motion.div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 360, damping: 32 }}
      >
        <div className={styles.head}>
          <div>
            <h2 id={titleId} className={styles.title}>
              Как вам проверка?
            </h2>
            <p className={styles.sub}>Четыре коротких вопроса — они помогут сделать разбор точнее.</p>
          </div>
          <button className={styles.close} onClick={onClose} aria-label="Закрыть">
            <IconClose size={20} />
          </button>
        </div>

        <div className={styles.block}>
          <span id={q1} className={styles.q}>
            Оцените свою удовлетворённость проверкой
          </span>
          <StarRating value={satisfaction} onChange={setSatisfaction} labelledBy={q1} />
        </div>

        <div className={styles.block}>
          <span className={styles.q}>Где модель была слишком строга или простительна?</span>
          <div className={styles.segmented} role="group" aria-label="Строгость проверки">
            {STRICTNESS.map((s) => {
              const on = strictness === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  className={`${styles.segBtn} ${on ? styles.segOn : ''}`}
                  onClick={() => setStrictness(on ? null : s.id)}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
          <textarea
            className={styles.field}
            rows={2}
            maxLength={MAX_TEXT}
            value={strictnessNote}
            onChange={(e) => setStrictnessNote(e.target.value)}
            placeholder="Где именно? Например: занизили К2 за аргументы"
            aria-label="Где именно модель была слишком строга или простительна"
          />
        </div>

        <div className={styles.block}>
          <span id={q3} className={styles.q}>
            Оцените удобство такого формата проверки работ
          </span>
          <StarRating value={convenience} onChange={setConvenience} labelledBy={q3} />
        </div>

        <div className={styles.block}>
          <span className={styles.q}>Чего не хватает?</span>
          <textarea
            className={styles.field}
            rows={2}
            maxLength={MAX_TEXT}
            value={missing}
            onChange={(e) => setMissing(e.target.value)}
            placeholder="Что добавить или улучшить"
            aria-label="Чего не хватает"
          />
        </div>

        <div className={styles.foot}>
          {!ready && <span className={styles.hint}>Поставьте обе оценки звёздами</span>}
          <div className={styles.footBtns}>
            <Button variant="ghost" onClick={onClose}>
              Не сейчас
            </Button>
            <Button onClick={submit} disabled={!ready || sending}>
              {sending ? 'Отправляем…' : 'Отправить'}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* Всплывающая анкета отзыва о проверке. checkId = null — окно закрыто. */
export function FeedbackModal({
  checkId,
  onClose,
  onToast,
}: {
  checkId: number | null
  onClose: () => void
  onToast: (text: string, kind?: ToastKind) => void
}) {
  return (
    <AnimatePresence>
      {checkId !== null && (
        <FeedbackDialog key={checkId} checkId={checkId} onClose={onClose} onToast={onToast} />
      )}
    </AnimatePresence>
  )
}
