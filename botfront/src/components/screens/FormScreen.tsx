import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { AttachedFile, WorkType } from '../../lib/types'
import { WORK_TYPES, WORK_TYPE_ORDER } from '../../lib/workTypes'
import { Button } from '../ui/Button'
import { ErrorBanner } from '../ui/ErrorBanner'
import { useCountUp } from '../../lib/useCountUp'
import {
  IconArrowRight,
  IconBolt,
  IconBook,
  IconCamera,
  IconCheck,
  IconCheckDoc,
  IconMail,
  IconPen,
  IconSparkles,
  IconTarget,
  IconUpload,
} from '../../lib/icons'
import { fetchMe, recognizePhoto } from '../../lib/api'
import { fileToDataUrl, resizeImageToBase64 } from '../../lib/image'
import { MAX_FILE_BYTES, MAX_PHOTOS } from '../../lib/config'
import styles from './FormScreen.module.css'

const WORK_ICONS = { mail: IconMail, pen: IconPen, book: IconBook }

// Витринное число «работ проверено» на случай, если бэкенд недоступен. Как только
// придёт живой счётчик из БД (GET /api/me), он заменит эту заглушку. Как на сайте.
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

export interface FormState {
  selectedType: WorkType | null
  /** Фото задания. Бэкенд отдаёт их модели как картинки (см. core/grok_check.py). */
  photos: string[]
  /** Файл задания (PDF/txt). Текст из него бэкенд достаёт сам (pypdf). */
  file: AttachedFile | null
  /** Текст работы ученика — набранный или распознанный с фото. */
  text: string
}

interface Props {
  form: FormState
  error: { text: string; id: number } | null
  onSelectType: (type: WorkType) => void
  onPhotosChange: (photos: string[]) => void
  onFileChange: (file: AttachedFile | null) => void
  onTextChange: (text: string) => void
  onRecognized: (text: string) => void
  onError: (msg: string) => void
  onSubmit: () => void
}

/** Открыть системный выбор файла и вернуть выбранный файл (или null). Как на сайте. */
function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })
}

export function FormScreen({
  form,
  error,
  onSelectType,
  onPhotosChange,
  onFileChange,
  onTextChange,
  onRecognized,
  onError,
  onSubmit,
}: Props) {
  const reduce = useReducedMotion()
  // Идёт распознавание/прикрепление — блокируем кнопки, чтобы не запустить дважды.
  const [busy, setBusy] = useState(false)
  // Распознанный текст задания. Отдельным полем на сервер не уходит (у бэкенда бота
  // такого поля нет) — задание модель видит по фото из photos. Здесь он нужен,
  // чтобы человек убедился: снимок читаемый.
  const [taskText, setTaskText] = useState('')
  const [checksLeft, setChecksLeft] = useState<number | null>(null)
  const [totalChecks, setTotalChecks] = useState<number | null>(null)
  const checkerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    let alive = true
    fetchMe(ctrl.signal).then((me) => {
      if (!alive) return
      setTotalChecks(me.totalChecks)
      // Локально (npm run dev) бэкенда рядом нет и initData не выдаётся, поэтому
      // остаток не придёт. Чтобы плашку было видно при вёрстке, в DEV подставляем
      // демо-число. В прод-сборке этой ветки нет — Vite её вырезает.
      if (me.checksLeft === null && import.meta.env.DEV) {
        setChecksLeft(3)
        return
      }
      setChecksLeft(me.checksLeft)
    })
    return () => {
      alive = false
      ctrl.abort()
    }
  }, [])

  function scrollToChecker() {
    checkerRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  // ── Задание: фото ──
  // Снимок и распознаём (показать человеку), и прикладываем в photos — так задание
  // реально доезжает до модели через существующий контракт бэкенда.
  async function addTaskPhoto() {
    if (busy) return
    if (form.photos.length >= MAX_PHOTOS) {
      onError(`⚠️ Не больше ${MAX_PHOTOS} фото задания`)
      return
    }
    const file = await pickFile('image/*')
    if (!file) return
    setBusy(true)
    try {
      const dataUrl = await resizeImageToBase64(file)
      onPhotosChange([...form.photos, dataUrl])
      const recognized = await recognizePhoto(dataUrl)
      if (recognized.trim()) setTaskText(recognized.trim())
    } catch (e) {
      onError('❌ ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setBusy(false)
    }
  }

  // ── Задание: файл ──
  // PDF/txt не гоняем через распознавание: текст из файла достаёт бэкенд (pypdf).
  async function addTaskFile() {
    if (busy) return
    const file = await pickFile('application/pdf,text/plain')
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      onError(`⚠️ Файл больше ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} МБ`)
      return
    }
    setBusy(true)
    try {
      onFileChange({
        name: file.name,
        type: file.type,
        size: file.size,
        data: await fileToDataUrl(file),
      })
    } catch (e) {
      onError('❌ ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setBusy(false)
    }
  }

  // ── Работа: фото рукописи → распознанный текст дописываем в поле работы ──
  async function recognizeWorkPhoto() {
    if (busy) return
    const file = await pickFile('image/*')
    if (!file) return
    setBusy(true)
    try {
      const recognized = await recognizePhoto(await resizeImageToBase64(file))
      if (!recognized.trim()) {
        onError('⚠️ На фото не нашлось текста')
        return
      }
      onRecognized(recognized.trim())
    } catch (e) {
      onError('❌ ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {/* ── Геро ── */}
      <section className={styles.hero}>
        <div>
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
            <Button onClick={scrollToChecker} trailing={<IconArrowRight size={20} />}>
              Проверить работу
            </Button>
          </div>
          <p className={styles.note}>Первая проверка — бесплатно</p>
        </div>

        {/* Декоративные «стикеры». На сайте показываются только от 920px —
            на телефоне этот блок скрыт правилом .heroArt, как и там. */}
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
          <img className={styles.heroBear} src="/bear.png" alt="" />
        </div>
      </section>

      {/* ── Полоса статистики ── */}
      <section className={styles.statsWrap}>
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
      <section className={styles.checkerSection} ref={checkerRef}>
        {checksLeft !== null && (
          <p className={styles.balance}>
            <IconCheckDoc size={16} />
            Осталось проверок: <b>{checksLeft}</b>
          </p>
        )}

        <div className={styles.head}>
          <h2 className={styles.h2}>Проверить работу</h2>
          <p className={styles.h2sub}>
            Выбери тип работы и вставь текст — получишь разбор по критериям.
          </p>
        </div>

        <div className={styles.card}>
          {error ? <ErrorBanner key={error.id} message={error.text} /> : null}

          {/* Шаг 1 — тип работы */}
          <FormStep n={1} title="Тип работы" sub="Что именно проверяем" />
          <div className={styles.typeList}>
            {WORK_TYPE_ORDER.map((type) => {
              const meta = WORK_TYPES[type]
              const Icon = WORK_ICONS[meta.iconKey]
              const isSel = form.selectedType === type
              return (
                <button
                  key={type}
                  type="button"
                  className={`${styles.typeCard} ${isSel ? styles.typeSel : ''}`}
                  onClick={() => onSelectType(type)}
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

          {/* Шаг 2 — задание */}
          <FormStep n={2} title="Задание" sub="Фото или файл с текстом задания" spaced />
          <div className={styles.attachRow}>
            <button type="button" className={styles.attach} disabled={busy} onClick={addTaskPhoto}>
              <IconCamera size={18} /> Фото задания
            </button>
            <button type="button" className={styles.attach} disabled={busy} onClick={addTaskFile}>
              <IconUpload size={18} /> Файл задания
            </button>
          </div>
          {taskText.trim() && <p className={styles.recognizedNote}>Задание распознано ✓</p>}
          {form.file && <p className={styles.recognizedNote}>Файл задания прикреплён ✓</p>}

          {/* Шаг 3 — работа ученика */}
          <FormStep n={3} title="Работа ученика" sub="Текст или фото рукописной работы" spaced />
          <textarea
            className={styles.textarea}
            value={form.text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Вставь или напечатай работу ученика…"
            rows={6}
            aria-label="Работа ученика — текст"
          />
          <div className={styles.attachRow}>
            <button
              type="button"
              className={styles.attach}
              disabled={busy}
              onClick={recognizeWorkPhoto}
            >
              <IconCamera size={18} /> Фото работы (рукопись)
            </button>
          </div>

          <Button
            spaced
            onClick={onSubmit}
            disabled={busy}
            leading={busy ? undefined : <IconCheck size={20} />}
          >
            {busy ? 'Распознаём…' : 'Проверить работу'}
          </Button>
        </div>
      </section>

      {/* ── Как это работает ── */}
      <section className={styles.steps}>
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

/** Нумерованный шаг формы — как на сайте (отступ через класс, а не инлайновый стиль). */
function FormStep({ n, title, sub, spaced }: { n: number; title: string; sub: string; spaced?: boolean }) {
  return (
    <div className={`${styles.formStep} ${spaced ? styles.formStepSpaced : ''}`}>
      <span className={styles.formStepNum}>{n}</span>
      <span className={styles.formStepText}>
        <span className={styles.formStepTitle}>{title}</span>
        <span className={styles.formStepSub}>{sub}</span>
      </span>
    </div>
  )
}

/** Плитка статистики с «докручиванием» числа — как на сайте. */
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
