/* Типы работ для формы проверки. iconKey ссылается на SVG-иконку (см. icons.tsx),
   чтобы не использовать эмодзи. Шкалы совпадают с Telegram-версией (ЕГЭ-2026). */

export type WorkType = 'email' | 'essay' | 'composition'
export type WorkIconKey = 'mail' | 'pen' | 'book'

export interface WorkTypeMeta {
  type: WorkType
  iconKey: WorkIconKey
  title: string
  subtitle: string
  /** Подпись результата. */
  resultLabel: string
  /** Максимальный итоговый балл. */
  maxScore: number
}

export const WORK_TYPES: Record<WorkType, WorkTypeMeta> = {
  email: {
    type: 'email',
    iconKey: 'mail',
    title: 'Английский Email',
    subtitle: 'Задание 37 — деловое письмо',
    resultLabel: 'Задание 37 • Английский',
    maxScore: 6,
  },
  essay: {
    type: 'essay',
    iconKey: 'pen',
    title: 'Английское эссе',
    subtitle: 'Задание 38 — развёрнутое мнение',
    resultLabel: 'Задание 38 • Английский',
    maxScore: 14,
  },
  composition: {
    type: 'composition',
    iconKey: 'book',
    title: 'Русское сочинение',
    subtitle: 'Задание 27 — сочинение',
    resultLabel: 'Задание 27 • Русский',
    maxScore: 22,
  },
}

export const WORK_TYPE_ORDER: WorkType[] = ['email', 'essay', 'composition']
