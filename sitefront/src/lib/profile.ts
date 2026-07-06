/* Заглушечные данные для окна «Профиль». Это шаблон — данные выдуманы,
   реального аккаунта/базы пользователей нет. */

import type { WorkIconKey } from './workTypes'

export interface ProfileStat {
  label: string
  value: string
  /** ключ иконки из icons.tsx */
  iconKey: 'target' | 'bolt' | 'flame' | 'star'
}

export interface RecentCheck {
  id: string
  title: string
  date: string
  score: string
  iconKey: WorkIconKey
}

export interface Achievement {
  id: string
  title: string
  desc: string
  iconKey: 'trophy' | 'flame' | 'star' | 'bolt'
  unlocked: boolean
}

export const PROFILE = {
  name: 'Камиль В.',
  email: 'kamil@example.com',
  joined: 'с марта 2026',
  plan: 'Бесплатный',
}

export const PROFILE_STATS: ProfileStat[] = [
  { label: 'Работ проверено', value: '47', iconKey: 'target' },
  { label: 'Средний балл', value: '83%', iconKey: 'bolt' },
  { label: 'Серия дней', value: '12', iconKey: 'flame' },
  { label: 'Лучший результат', value: '21/22', iconKey: 'star' },
]

export const RECENT_CHECKS: RecentCheck[] = [
  { id: 'r1', title: 'Английское эссе', date: 'сегодня, 14:20', score: '11/14', iconKey: 'pen' },
  { id: 'r2', title: 'Русское сочинение', date: 'вчера, 19:05', score: '18/22', iconKey: 'book' },
  { id: 'r3', title: 'Английский Email', date: '14 июня', score: '5/6', iconKey: 'mail' },
  { id: 'r4', title: 'Английское эссе', date: '12 июня', score: '9/14', iconKey: 'pen' },
]

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'a1', title: 'Первый шаг', desc: 'Первая проверка работы', iconKey: 'star', unlocked: true },
  { id: 'a2', title: 'На потоке', desc: 'Серия из 10 дней', iconKey: 'flame', unlocked: true },
  { id: 'a3', title: 'Отличник', desc: 'Балл 90%+ за работу', iconKey: 'trophy', unlocked: true },
  { id: 'a4', title: 'Марафонец', desc: '100 проверок', iconKey: 'bolt', unlocked: false },
]
