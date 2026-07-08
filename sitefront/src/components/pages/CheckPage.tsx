import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Button } from '../ui/Button'
import { useCountUp } from '../../lib/useCountUp'
import { WORK_TYPES, WORK_TYPE_ORDER, type WorkType } from '../../lib/workTypes'
import { ResultView } from '../result/ResultView'
import type { StructuredResult } from '../../lib/result'
import { api, ApiError, errorMessage } from '../../lib/api'
import type { Page } from '../../lib/nav'
import {
  IconArrowRight,
  IconBook,
  IconBolt,
  IconCamera,
  IconCheck,
  IconMail,
  IconPen,
  IconSparkles,
  IconTarget,
  IconUpload,
} from '../../lib/icons'
import type { ToastKind } from '../ui/Toast'
import styles from './CheckPage.module.css'

const WORK_ICONS = { mail: IconMail, pen: IconPen, book: IconBook }

// Короткие подписи для переключателя примеров (как сегментный контрол на «Счётчике ЕГЭ»).
const EXAMPLE_LABELS: Record<WorkType, string> = {
  email: 'Email',
  essay: 'Эссе',
  composition: 'Сочинение',
}

// Витринное число «работ проверено» на случай, если бэкенд недоступен. Как только
// придёт живой счётчик из БД (api.stats.getTotalChecks), он заменит эту заглушку.
const FALLBACK_TOTAL_CHECKS = 12480

const STATS = [
  { value: FALLBACK_TOTAL_CHECKS, suffix: '', label: 'работ проверено', Icon: IconTarget },
  { value: 96, suffix: '%', label: 'совпадение с экспертом', Icon: IconCheck },
  { value: 60, suffix: ' сек', label: 'средняя проверка', Icon: IconBolt },
  { value: 2, suffix: '', label: 'языка: рус + англ', Icon: IconSparkles },
]

const STEPS = [
  { n: 1, title: 'Выбери тип работы', desc: 'Email, эссе по английскому или сочинение по русскому.' },
  { n: 2, title: 'Вставь текст или фото', desc: 'Напечатай работу или прикрепи скан — распознаем сами.' },
  { n: 3, title: 'Получи разбор', desc: 'Баллы по каждому критерию ЕГЭ и что улучшить.' },
]

// Открыть системный выбор файла и вернуть выбранный файл (или null).
function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })
}

export function CheckPage({
  onToast,
  onNavigate,
  onBalanceChange,
}: {
  onToast: (text: string, kind?: ToastKind) => void
  onNavigate: (p: Page) => void
  onBalanceChange: (balance: number) => void
}) {
  const reduce = useReducedMotion()
  // Публичный счётчик проверок для первой плитки статистики. null — ещё не загрузили
  // (или бэк недоступен): тогда показываем витринное FALLBACK_TOTAL_CHECKS.
  const [totalChecks, setTotalChecks] = useState<number | null>(null)
  useEffect(() => {
    let alive = true
    api.stats
      .getTotalChecks()
      .then((r) => alive && setTotalChecks(r.totalChecks))
      .catch(() => {}) // бэк недоступен — оставляем витринное число
    return () => {
      alive = false
    }
  }, [])
  const [selected, setSelected] = useState<WorkType | null>('essay')
  const [text, setText] = useState('')
  // Распознанный текст задания (с фото/файла) — уходит на сервер вместе с работой.
  const [taskText, setTaskText] = useState('')
  // Идёт проверка / распознавание — блокируем кнопки.
  const [checking, setChecking] = useState(false)
  const [busy, setBusy] = useState(false)
  // Реальный разбор с сервера и тип работы, к которому он относится.
  const [result, setResult] = useState<StructuredResult | null>(null)
  const [resultType, setResultType] = useState<WorkType | null>(null)
  // Какой пример разбора показан (null — блок примера ещё скрыт).
  const [exampleType, setExampleType] = useState<WorkType | null>(null)
  const checkerRef = useRef<HTMLDivElement>(null)
  const exampleRef = useRef<HTMLDivElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  function scrollToChecker() {
    checkerRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  // «Посмотреть пример»: показываем блок примера (по умолчанию email) и прокручиваем к нему.
  function showExample() {
    setExampleType((t) => t ?? 'email')
    window.setTimeout(() => {
      exampleRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    }, 60)
  }

  // Распознать текст с фото/файла в поле задания или работы.
  async function recognizeInto(target: 'task' | 'work', accept: string) {
    if (busy || checking) return
    const file = await pickFile(accept)
    if (!file) return
    setBusy(true)
    try {
      const { text: recognized } = await api.checks.recognizeImage(file)
      if (target === 'work') {
        setText((prev) => (prev.trim() ? `${prev}\n${recognized}` : recognized))
        onToast('Текст работы распознан', 'success')
      } else {
        setTaskText(recognized)
        onToast('Текст задания распознан', 'success')
      }
    } catch (e) {
      onToast(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  // Проверка работы: отправляем на сервер, показываем разбор, обновляем баланс.
  async function handleFormCheck() {
    if (!selected) {
      onToast('Выберите тип работы', 'info')
      return
    }
    if (!text.trim()) {
      onToast('Вставьте или распознайте текст работы', 'info')
      return
    }
    setChecking(true)
    try {
      const res = await api.checks.checkWork({
        workType: selected,
        taskText: taskText.trim() || undefined,
        studentText: text,
      })
      setResult(res.result)
      setResultType(selected)
      onBalanceChange(res.balance)
      window.setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
      }, 60)
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        onToast('Войдите в аккаунт, чтобы проверять работы', 'info')
        onNavigate('auth')
      } else if (e instanceof ApiError && (e.status === 402 || e.status === 403)) {
        onToast('Закончились проверки — пополните баланс', 'info')
        onNavigate('pricing')
      } else {
        onToast(errorMessage(e), 'error')
      }
    } finally {
      setChecking(false)
    }
  }

  return (
    <div>
      {/* ── Геро ── */}
      <section className={`container ${styles.hero}`}>
        <div className={styles.heroText}>
          <span className={styles.eyebrow}>
            <IconSparkles size={15} /> Проверка по критериям ЕГЭ
          </span>
          <h1 className={styles.h1}>
            Проверим твоё <span className={styles.markCoral}>эссе</span> и{' '}
            <span className={styles.markIndigo}>сочинение</span> за минуту
          </h1>
          <p className={styles.lead}>
            Загрузи работу по английскому или русскому — получишь баллы по каждому критерию
            и понятные советы, что подтянуть до экзамена.
          </p>
          <div className={styles.heroActions}>
            <Button size="lg" onClick={scrollToChecker} trailing={<IconArrowRight size={20} />}>
              Проверить работу
            </Button>
            <Button size="lg" variant="secondary" onClick={showExample}>
              Посмотреть пример
            </Button>
          </div>
          <p className={styles.note}>Без регистрации · первая проверка бесплатно</p>
        </div>

        {/* Декоративные «стикеры» */}
        <div className={styles.heroArt} aria-hidden="true">
          <motion.div
            className={`${styles.sticker} ${styles.stickerA}`}
            initial={reduce ? false : { opacity: 0, y: 24, rotate: -10 }}
            animate={{ opacity: 1, y: 0, rotate: -6 }}
            transition={{ type: 'spring', stiffness: 220, damping: 20, delay: 0.05 }}
          >
            <span className={styles.stickerScore}>11/14</span>
            <span className={styles.stickerCap}>Эссе · English</span>
          </motion.div>
          <motion.div
            className={`${styles.sticker} ${styles.stickerB}`}
            initial={reduce ? false : { opacity: 0, y: 24, rotate: 8 }}
            animate={{ opacity: 1, y: 0, rotate: 5 }}
            transition={{ type: 'spring', stiffness: 220, damping: 20, delay: 0.15 }}
          >
            <span className={styles.stickerScore}>18/22</span>
            <span className={styles.stickerCap}>Сочинение · Рус</span>
          </motion.div>
          <motion.div
            className={`${styles.sticker} ${styles.stickerC}`}
            initial={reduce ? false : { opacity: 0, scale: 0.6, rotate: -14 }}
            animate={{ opacity: 1, scale: 1, rotate: -8 }}
            transition={{ type: 'spring', stiffness: 240, damping: 18, delay: 0.25 }}
          >
            <IconCheck size={30} />
          </motion.div>
        </div>
      </section>

      {/* ── Полоса статистики ── */}
      <section className={`container ${styles.statsWrap}`}>
        <div className={styles.stats}>
          {STATS.map((s, i) => (
            <StatTile
              key={s.label}
              {...s}
              value={i === 0 && totalChecks !== null ? totalChecks : s.value}
            />
          ))}
        </div>
      </section>

      {/* ── Инструмент проверки ── */}
      <section className={`container ${styles.checkerSection}`} ref={checkerRef}>
        <div className={styles.checkerHead}>
          <h2 className={styles.h2}>Проверить работу</h2>
          <p className={styles.h2sub}>Выбери тип работы и вставь текст — получишь разбор по критериям.</p>
        </div>

        <div className={styles.checkerCard}>
          {/* Шаг 1 — тип работы */}
          <FormStep n={1} title="Тип работы" sub="Что именно проверяем" />
          <div className={styles.typeList}>
            {WORK_TYPE_ORDER.map((type) => {
              const meta = WORK_TYPES[type]
              const Icon = WORK_ICONS[meta.iconKey]
              const isSel = selected === type
              return (
                <button
                  key={type}
                  className={`${styles.typeCard} ${isSel ? styles.typeSel : ''}`}
                  onClick={() => setSelected(type)}
                  aria-pressed={isSel}
                >
                  <span className={styles.typeIcon}>
                    <Icon size={22} />
                  </span>
                  <span className={styles.typeInfo}>
                    <span className={styles.typeTitle}>{meta.title}</span>
                    <span className={styles.typeSub}>{meta.subtitle}</span>
                  </span>
                  <span className={styles.typeCheck}>
                    <IconCheck size={16} />
                  </span>
                </button>
              )
            })}
          </div>

          {/* Шаг 2 — задание (что нужно было выполнить) */}
          <FormStep
            n={2}
            title="Задание"
            sub="Фото или файл с текстом задания"
            style={{ marginTop: 26 }}
          />
          <div className={styles.attachRow}>
            <button
              className={styles.attach}
              disabled={busy || checking}
              onClick={() => recognizeInto('task', 'image/*')}
            >
              <IconCamera size={18} /> Фото задания
            </button>
            <button
              className={styles.attach}
              disabled={busy || checking}
              onClick={() => recognizeInto('task', 'image/*,application/pdf')}
            >
              <IconUpload size={18} /> Файл задания
            </button>
          </div>
          {taskText.trim() && <p className={styles.recognizedNote}>Задание распознано ✓</p>}

          {/* Шаг 3 — работа ученика */}
          <FormStep
            n={3}
            title="Работа ученика"
            sub="Текст или фото рукописной работы"
            style={{ marginTop: 26 }}
          />
          <textarea
            className={styles.textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Вставь или напечатай работу ученика…"
            rows={6}
            aria-label="Работа ученика — текст"
          />
          <div className={styles.attachRow}>
            <button
              className={styles.attach}
              disabled={busy || checking}
              onClick={() => recognizeInto('work', 'image/*')}
            >
              <IconCamera size={18} /> Фото работы (рукопись)
            </button>
          </div>

          <Button
            fullWidth
            size="lg"
            className={styles.submit}
            onClick={handleFormCheck}
            disabled={checking || busy}
            leading={checking ? undefined : <IconCheck size={20} />}
          >
            {checking ? 'Проверяем…' : 'Проверить работу'}
          </Button>
        </div>

      </section>

      {/* ── Результат проверки (после отправки на сервер) ── */}
      {result && resultType && (
        <section className={`container ${styles.exampleSection}`} ref={resultRef}>
          <div className={styles.checkerHead}>
            <h2 className={styles.h2}>Результат проверки</h2>
            <p className={styles.h2sub}>Баллы по критериям ЕГЭ и разбор ошибок.</p>
          </div>
          <AnimatePresence mode="wait">
            <ResultView key="live-result" type={resultType} result={result} />
          </AnimatePresence>
        </section>
      )}

      {/* ── Пример разбора (появляется по кнопке «Посмотреть пример») ── */}
      {exampleType && (
        <section className={`container ${styles.exampleSection}`} ref={exampleRef}>
          <div className={styles.checkerHead}>
            <h2 className={styles.h2}>Пример разбора</h2>
            <p className={styles.h2sub}>Выбери тип работы — покажем готовый разбор.</p>
          </div>

          <div className={styles.segmented} role="group" aria-label="Тип работы для примера">
            {WORK_TYPE_ORDER.map((t) => {
              const active = t === exampleType
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={active}
                  className={`${styles.segBtn} ${active ? styles.segActive : ''}`}
                  onClick={() => setExampleType(t)}
                >
                  {EXAMPLE_LABELS[t]}
                </button>
              )
            })}
          </div>

          <AnimatePresence mode="wait">
            <ResultView key={exampleType} type={exampleType} />
          </AnimatePresence>
        </section>
      )}

      {/* ── Как это работает ── */}
      <section className={`container ${styles.steps}`}>
        <h2 className={styles.h2}>Как это работает</h2>
        <div className={styles.stepGrid}>
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              className={styles.step}
              initial={reduce ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.4, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className={styles.stepNum}>{s.n}</span>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              <p className={styles.stepDesc}>{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  )
}

function FormStep({
  n,
  title,
  sub,
  style,
}: {
  n: number
  title: string
  sub: string
  style?: CSSProperties
}) {
  return (
    <div className={styles.formStep} style={style}>
      <span className={styles.formStepNum}>{n}</span>
      <span className={styles.formStepText}>
        <span className={styles.formStepTitle}>{title}</span>
        <span className={styles.formStepSub}>{sub}</span>
      </span>
    </div>
  )
}

function StatTile({
  value,
  suffix,
  label,
  Icon,
}: {
  value: number
  suffix: string
  label: string
  Icon: (p: { size?: number }) => JSX.Element
}) {
  const n = useCountUp(value)
  return (
    <div className={styles.statTile}>
      <span className={styles.statIcon}>
        <Icon size={20} />
      </span>
      <span className={styles.statValue}>
        {n.toLocaleString('ru-RU')}
        {suffix}
      </span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}
