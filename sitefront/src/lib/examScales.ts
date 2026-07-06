/* ── Разбалловка ЕГЭ: перевод первичных баллов в тестовые (100-балльные) ──
   Данные лежат в src/data/examScales.json (копия add/ege_russian_english_scales.json).
   Здесь — типы и удобный доступ: отсортированные строки и нарезка на колонки. */

import raw from '../data/examScales.json'

/* ── Типы данных ── */

/** Одна строка таблицы: первичный балл → тестовый. */
export interface ScaleRow {
  primary: number
  test: number
}

/** Шкала одного предмета. */
export interface ExamScale {
  id: string
  /** Полное название для подписи: «Русский язык». */
  subject: string
  /** Короткое имя для переключателя: «Русский». */
  short: string
  /** Максимум первичных баллов (нижняя граница диапазона перевода). */
  maxPrimaryScore: number
  /** Максимум тестовых баллов (обычно 100). */
  maxTestScore: number
  /** Подсвечиваем строки с первичным баллом от 1 до этого значения включительно. */
  highlightTo: number
  /** Строки перевода, отсортированы по возрастанию первичного балла. */
  rows: ScaleRow[]
}

/* Форма данных в JSON (до обработки). */
interface RawScale {
  subject: string
  maxPrimaryScore: number
  maxTestScore: number
  conversion: Record<string, number>
}

const RAW = raw as Record<string, RawScale>

/* Превращаем «карту» conversion {"1": 3, ...} в отсортированный массив строк. */
function buildScale(
  id: string,
  short: string,
  highlightTo: number,
  src: RawScale,
): ExamScale {
  const rows = Object.entries(src.conversion)
    .map(([primary, test]) => ({ primary: Number(primary), test }))
    .sort((a, b) => a.primary - b.primary)
  return {
    id,
    subject: src.subject,
    short,
    maxPrimaryScore: src.maxPrimaryScore,
    maxTestScore: src.maxTestScore,
    highlightTo,
    rows,
  }
}

/* ⬇️ Предметы для вкладки «Экзамен». Порядок = порядок в переключателе.
   Третий аргумент — до какого первичного балла подсвечивать строки. */
export const EXAM_SCALES: ExamScale[] = [
  buildScale('russian', 'Русский', 22, RAW.russian),
  buildScale('english', 'Английский', 20, RAW.english),
]

/** Нарезает строки на колонки по `size` строк — чтобы длинная таблица
    разложилась в несколько компактных столбцов, а не тянулась вниз. */
export function chunkRows(rows: ScaleRow[], size: number): ScaleRow[][] {
  const columns: ScaleRow[][] = []
  for (let i = 0; i < rows.length; i += size) {
    columns.push(rows.slice(i, i + size))
  }
  return columns
}
