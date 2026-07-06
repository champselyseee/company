/* Структурированный результат проверки — формат, как в реальном фронте бота.
   Сюда вынесены ТОЛЬКО типы и подписи: сами демо-данные лежат в demo.ts,
   а отрисовка — в src/components/result/. Так контент, типы и вёрстка не путаются. */

// Тип ошибки у фрагмента текста. 'none' — обычный текст без подсветки.
export type ErrorType =
  | 'none'
  | 'spelling' // орфографическая
  | 'punctuation' // пунктуационная
  | 'grammar' // грамматическая
  | 'speech' // речевая
  | 'factual' // фактическая
  | 'logical' // логическая
  | 'recommendation' // рекомендация (не ошибка, а совет)

// Кусочек текста работы: t — сам текст, e — тип ошибки (или 'none').
// Сумма всех t по порядку = полный текст работы.
export interface ResultSegment {
  t: string
  e: ErrorType
}

// Один критерий ЕГЭ: код (К1…), набранный/максимальный балл, число ошибок, комментарий.
export interface ResultCriterion {
  code: string
  score: number
  max: number
  errors: number
  comment: string
}

// Задание, на которое отвечала работа (например, входящее письмо для задания 37).
// Опционально: показывается карточкой вверху разбора, если задано.
export interface ResultTask {
  label?: string // ярлык вверху, напр. «Задание 37 · Письмо»
  from?: string // отправитель письма-стимула, напр. «Oscar@mail.uk»
  subject?: string // тема письма-стимула, напр. «Food»
  text: string // сам текст задания/стимула
}

// Полный разбор работы: задание, итоговый балл, размеченный текст, критерии и резюме.
export interface StructuredResult {
  task?: ResultTask
  score: number
  max_score: number
  segments: ResultSegment[]
  criteria: ResultCriterion[]
  summary: string
}

// Только «настоящие» типы ошибок (без 'none') — для легенды и подписей.
type RealError = Exclude<ErrorType, 'none'>

// Человеческие подписи типов ошибок (как в легенде на референсе бота).
export const ERROR_LABELS: Record<RealError, string> = {
  spelling: 'Орфографическая',
  punctuation: 'Пунктуационная',
  grammar: 'Грамматическая',
  speech: 'Речевая',
  factual: 'Фактическая',
  logical: 'Логическая',
  recommendation: 'Рекомендация',
}

// Порядок отображения чипов в легенде.
export const ERROR_ORDER: RealError[] = [
  'spelling',
  'punctuation',
  'grammar',
  'speech',
  'factual',
  'logical',
  'recommendation',
]
