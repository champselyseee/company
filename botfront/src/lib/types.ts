export type WorkType = 'email' | 'essay' | 'composition'

export type Screen =
  | 'checking'
  | 'noaccess'
  | 'form'
  | 'loading'
  | 'result'

export interface AttachedFile {
  name: string
  type: string
  size: number
  data: string // data URL
}

export interface WorkTypeMeta {
  type: WorkType
  icon: string
  title: string
  subtitle: string
  /** Заголовок результата. */
  resultLabel: string
  /** Максимальный итоговый балл. */
  maxScore: number
  /** Максимум по каждому критерию К1..Кn (1-индексация). */
  criteriaMax: Record<number, number>
}

export interface ProxyResponse {
  answer?: string
  error?: string
}

export interface OcrResponse {
  text?: string
  error?: string
}

export interface CheckTokenResponse {
  ok?: boolean
}

// Ответ бэкенда со статистикой для счётчиков на форме.
// total_checks — общий публичный счётчик; user_checks — сколько проверок у этого пользователя.
export interface StatsResponse {
  total_checks?: number
  user_checks?: number
}

// ── Структурированный результат проверки (новый формат бэкенда) ──

export type ErrorType =
  | 'none'
  | 'spelling'
  | 'punctuation'
  | 'grammar'
  | 'speech'
  | 'factual'
  | 'logical'
  | 'recommendation'

export interface ResultSegment {
  t: string
  e: ErrorType
}

export interface ResultCriterion {
  code: string
  score: number
  max: number
  errors: number
  comment: string
}

export interface StructuredResult {
  score: number
  max_score: number
  segments: ResultSegment[]
  criteria: ResultCriterion[]
  summary: string
}
