import type { WorkType, WorkTypeMeta } from './types'

// Метаданные типов работ. criteriaMax отражает реальную шкалу ЕГЭ-2026
// (в старом index-9 был один общий map с max=3 для К1–К3, что давало неверный
// знаменатель для email/composition — здесь исправлено по каждому типу).
export const WORK_TYPES: Record<WorkType, WorkTypeMeta> = {
  email: {
    type: 'email',
    icon: '📧',
    title: 'Английский Email',
    subtitle: 'Деловое письмо по ЕГЭ',
    resultLabel: 'Задание 37 • Английский',
    maxScore: 6,
    criteriaMax: { 1: 2, 2: 2, 3: 2 },
  },
  essay: {
    type: 'essay',
    icon: '📝',
    title: 'Английское эссе',
    subtitle: 'Эссе по ЕГЭ',
    resultLabel: 'Задание 38 • Английский',
    maxScore: 14,
    criteriaMax: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 2 },
  },
  composition: {
    type: 'composition',
    icon: '📖',
    title: 'Русское сочинение',
    subtitle: 'Сочинение по ЕГЭ',
    resultLabel: 'Задание 27 • Русский',
    maxScore: 22,
    criteriaMax: { 1: 1, 2: 3, 3: 2, 4: 1, 5: 2, 6: 1, 7: 3, 8: 3, 9: 3, 10: 3 },
  },
}

export const WORK_TYPE_ORDER: WorkType[] = ['email', 'essay', 'composition']
