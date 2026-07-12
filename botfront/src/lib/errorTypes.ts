import type { ErrorType } from './types'

type RealError = Exclude<ErrorType, 'none'>

// Человеческие подписи типов ошибок (как в легенде на референсе).
export const ERROR_LABELS: Record<RealError, string> = {
  spelling: 'Орфографическая',
  punctuation: 'Пунктуационная',
  grammar: 'Грамматическая',
  speech: 'Речевая',
  factual: 'Фактическая',
  logical: 'Логическая',
  recommendation: 'Рекомендация',
}

// Порядок отображения в легенде.
export const ERROR_ORDER: RealError[] = [
  'spelling',
  'punctuation',
  'grammar',
  'speech',
  'factual',
  'logical',
  'recommendation',
]
