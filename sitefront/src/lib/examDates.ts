/* ── Данные счётчика ЕГЭ ──
   Заглушка: два предмета — Английский и Русский. Даты примерные, поменяй
   month/day (или задай конкретный year) в одной строке ниже.

   Как это работает: если year не указан, счётчик берёт БЛИЖАЙШУЮ будущую дату
   с этим числом/месяцем (в этом году, а если она уже прошла — в следующем).
   Поэтому счётчик всегда показывает «живое» положительное число дней. */

export interface Exam {
  id: string
  /** Полное название для карточки. */
  subject: string
  /** Короткое имя для компактных мест. */
  shortName: string
  /** Очень короткая подпись для шапки: «Рус», «Англ». */
  abbr: string
  /** Форма для шапки: «по русскому», «по английскому». */
  dative: string
  /** Месяц экзамена, 1–12. */
  month: number
  /** День экзамена. */
  day: number
  /** Необязательно: жёстко зафиксировать год. Иначе берётся ближайший будущий. */
  year?: number
}

/* ⬇️ Меняй предметы и даты здесь. */
export const EXAMS: Exam[] = [
  { id: 'russian', subject: 'Русский язык', shortName: 'Русский', abbr: 'Рус', dative: 'русскому', month: 5, day: 28 },
  { id: 'english', subject: 'Английский язык', shortName: 'Английский', abbr: 'Англ', dative: 'английскому', month: 6, day: 9 },
]

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Дата экзамена: либо зафиксированный год, либо ближайший будущий. */
export function resolveExamDate(exam: Exam, from: Date = new Date()): Date {
  if (exam.year) return new Date(exam.year, exam.month - 1, exam.day)
  const thisYear = new Date(from.getFullYear(), exam.month - 1, exam.day)
  // Дата ещё не прошла (учитываем сам день экзамена) — берём этот год.
  if (startOfDay(thisYear) >= startOfDay(from)) return thisYear
  return new Date(from.getFullYear() + 1, exam.month - 1, exam.day)
}

/** Целое число дней от «сегодня» до даты (по календарным суткам). */
export function daysUntil(target: Date, from: Date = new Date()): number {
  return Math.round((startOfDay(target) - startOfDay(from)) / DAY_MS)
}

export interface CountdownParts {
  days: number
  hours: number
  minutes: number
  seconds: number
  totalMs: number
}

/** Разбивка точного оставшегося времени до полуночи дня экзамена. */
export function countdownParts(target: Date, from: Date = new Date()): CountdownParts {
  const totalMs = Math.max(0, target.getTime() - from.getTime())
  const days = Math.floor(totalMs / DAY_MS)
  const hours = Math.floor((totalMs % DAY_MS) / (60 * 60 * 1000))
  const minutes = Math.floor((totalMs % (60 * 60 * 1000)) / (60 * 1000))
  const seconds = Math.floor((totalMs % (60 * 1000)) / 1000)
  return { days, hours, minutes, seconds, totalMs }
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const weekdayFmt = new Intl.DateTimeFormat('ru-RU', { weekday: 'long' })

export function formatExamDate(d: Date): string {
  return dateFmt.format(d)
}

export function formatWeekday(d: Date): string {
  const w = weekdayFmt.format(d)
  return w.charAt(0).toUpperCase() + w.slice(1)
}

/** Склонение: 1 день, 2 дня, 5 дней. */
export function pluralDays(n: number): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return 'дней'
  if (last === 1) return 'день'
  if (last >= 2 && last <= 4) return 'дня'
  return 'дней'
}

export interface ExamView {
  exam: Exam
  date: Date
  days: number
}

/** Предметы с вычисленными датами в исходном порядке EXAMS (Рус, Англ). */
export function orderedExamViews(from: Date = new Date()): ExamView[] {
  return EXAMS.map((exam) => {
    const date = resolveExamDate(exam, from)
    return { exam, date, days: daysUntil(date, from) }
  })
}

/** Предметы, отсортированные по близости (ближайший первым). */
export function examViews(from: Date = new Date()): ExamView[] {
  return [...orderedExamViews(from)].sort((a, b) => a.days - b.days)
}
