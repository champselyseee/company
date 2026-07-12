/* База знаний для сочинения ЕГЭ: типы и доступ к данным.
   Данные лежат в src/data/knowledgeBase.json (копия корневого knowledge_base.json).
   Структура описана в knowledge_base.md. */

import raw from '../data/knowledgeBase.json'

/* ── Типы данных ── */

export interface KBMode {
  id: string
  icon: string
  label: string
}

export interface KBStats {
  arguments: number
  problems: number
  top_works: number
  strategies: number
  anti_mistakes: number
  modes: number
}

export interface KBMeta {
  title: string
  subtitle: string
  stats: KBStats
  source_url: string
}

export interface KBUiHints {
  search_placeholder: string
  empty_search: string
  problem_hint: string
  all_arguments_heading: string
}

export interface KBArgument {
  category: string
  title: string
  source: string
  text: string
  tags: string[]
}

/* Литературный аргумент проблемы: hero рендерим с 👤, episode с 🎥,
   conclusion со стрелкой →, badges — ярлыки (универсальный / 100-балльный / редкий сильный). */
export interface KBLiteraryArgument {
  source: string
  badges: string[]
  hero: string
  episode: string
  thesis: string
  conclusion: string
}

export interface KBHistoricalArgument {
  source: string
  text: string
  conclusion: string
}

export interface KBProblem {
  id: string
  title: string
  questions: string
  description: string
  authors_position: string
  tags: string[]
  intro_template: string
  conclusion_template: string
  linker: string
  literary_arguments: KBLiteraryArgument[]
  historical_arguments: KBHistoricalArgument[]
  scientific_arguments: KBHistoricalArgument[]
  ready_phrases: string[]
  common_mistakes: string[]
  also_fits_tags: string[]
}

/* ТОП-20 произведений: work — название, topics — темы-чипы,
   badge — ярлык уровня, frequency — как часто встречается на ЕГЭ. */
export interface KBTopWork {
  work: string
  author: string
  topics: string[]
  badge: string
  frequency: string
}

/* Группа внутри стратегии: заголовок + список пунктов (произведения/аргументы). */
export interface KBStrategyGroup {
  label: string
  items: string[]
}

/* Стратегия подготовки: план под конкретный запас времени до экзамена. */
export interface KBStrategy {
  id: string
  title: string
  intro: string
  groups: KBStrategyGroup[]
  tip: string
}

/* Блок антиошибок: категория ошибок + список того, чего не делать. */
export interface KBAntiMistake {
  id: string
  title: string
  items: string[]
}

export interface KnowledgeBase {
  meta: KBMeta
  modes: KBMode[]
  argument_categories: string[]
  ui_hints: KBUiHints
  arguments: KBArgument[]
  problems: KBProblem[]
  top_works: KBTopWork[]
  strategies: KBStrategy[]
  anti_mistakes: KBAntiMistake[]
}

/* JSON приходит со слишком широким выводом типов — приводим к нашей модели. */
const kb = raw as unknown as KnowledgeBase

export const KB = kb
export const KB_MODES = kb.modes
export const KB_META = kb.meta
export const KB_UI = kb.ui_hints
export const KB_CATEGORIES = kb.argument_categories
export const KB_ARGUMENTS = kb.arguments
export const KB_PROBLEMS = kb.problems
export const KB_TOP_WORKS = kb.top_works
export const KB_STRATEGIES = kb.strategies
export const KB_ANTI_MISTAKES = kb.anti_mistakes

/* Вкладки, под которые в базе есть реальные данные. Сейчас наполнены все пять. */
export const MODES_WITH_DATA = new Set([
  'all_arguments',
  'by_problems',
  'top20',
  'strategies',
  'anti_mistakes',
])

/* Поиск по аргументам: title + source + text + tags, регистронезависимо. */
export function searchArguments(items: KBArgument[], query: string): KBArgument[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter((a) => {
    const haystack = [a.title, a.source, a.text, ...a.tags].join(' ').toLowerCase()
    return haystack.includes(q)
  })
}

/* Фильтр по категории. «Все» (или пустая строка) — без фильтра. */
export function filterByCategory(items: KBArgument[], category: string): KBArgument[] {
  if (!category || category === 'Все') return items
  return items.filter((a) => a.category === category)
}
