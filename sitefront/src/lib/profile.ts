/* Статический конфиг окна «Профиль»: набор плиток статистики и определения
   достижений. Живые данные (имя, почта, баланс, значения статистики, история
   проверок, разблокированные достижения) приходят с сервера через слой api. */

// Плитка статистики: какой показатель, подпись и иконка.
export interface StatTileMeta {
  key: 'worksChecked' | 'averagePercent' | 'streakDays' | 'bestScore'
  label: string
  iconKey: 'target' | 'bolt' | 'flame' | 'star'
}

export const PROFILE_STAT_TILES: StatTileMeta[] = [
  { key: 'worksChecked', label: 'Работ проверено', iconKey: 'target' },
  { key: 'averagePercent', label: 'Средний балл', iconKey: 'bolt' },
  { key: 'streakDays', label: 'Серия дней', iconKey: 'flame' },
  { key: 'bestScore', label: 'Лучший результат', iconKey: 'star' },
]

// Определение достижения. Разблокировано ли — приходит с сервера отдельно (по id).
export interface AchievementDef {
  id: string
  title: string
  desc: string
  iconKey: 'trophy' | 'flame' | 'star' | 'bolt'
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'a1', title: 'Первый шаг', desc: 'Первая проверка работы', iconKey: 'star' },
  { id: 'a2', title: 'На потоке', desc: 'Серия из 10 дней', iconKey: 'flame' },
  { id: 'a3', title: 'Отличник', desc: 'Балл 90%+ за работу', iconKey: 'trophy' },
  { id: 'a4', title: 'Марафонец', desc: '100 проверок', iconKey: 'bolt' },
]
