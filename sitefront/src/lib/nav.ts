/* Разделы сайта и пункты верхней навигации. */

export type Page =
  | 'check'
  | 'knowledge'
  | 'pricing'
  | 'checkout'
  | 'projects'
  | 'counter'
  | 'profile'
  | 'auth'

export interface NavItem {
  id: Page
  label: string
  iconKey: 'check' | 'book' | 'star' | 'telegram' | 'calendar' | 'user'
}

/* Основные пункты в шапке. «Войти» рендерится отдельно сразу после «Профиля»
   (контрастный пункт, виден только неавторизованным) — см. Header.tsx.
   `check` и `checkout` в шапку не выводим: на «Проверку» ведёт логотип,
   на оформление попадают только из потока покупки.
   Раздел `projects` — страница Telegram-бота, стоит последним. */
export const NAV_ITEMS: NavItem[] = [
  { id: 'profile', label: 'Профиль', iconKey: 'user' },
  { id: 'pricing', label: 'Тарифы', iconKey: 'star' },
  { id: 'knowledge', label: 'База аргументов', iconKey: 'book' },
  { id: 'counter', label: 'Экзамен', iconKey: 'calendar' },
  { id: 'projects', label: 'Telegram-бот', iconKey: 'telegram' },
]
