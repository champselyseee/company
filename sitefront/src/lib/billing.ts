/* Тарифы и оплата (демо). Это UI-шаблон без бэкенда: цены и пакеты выдуманы,
   реальной оплаты нет — покупка имитируется и обновляет остаток локально. */

export type PaymentMethodId = 'youmoney' | 'tg_stars'

export interface CheckPackage {
  id: string
  checks: number
  price: number
  /** Цена за одну проверку (для якорения цены). */
  perCheck: number
  badge?: string
  /** Выделить карточку как рекомендуемую. */
  highlight?: boolean
}

export interface SubPlan {
  id: string
  name: string
  /** Длительность подписки, напр. «месяц», «6 месяцев». */
  period: string
  price: number
  checksPerMonth: number
  features: string[]
  badge?: string
  /** Выделить карточку как рекомендуемую. */
  highlight?: boolean
}

export interface PaymentMethod {
  id: PaymentMethodId
  label: string
  iconKey: 'youmoney' | 'telegram'
  note: string
}

/* Нормализованный объект для страницы оформления — общий для пакета и подписки. */
export interface PurchaseOffer {
  kind: 'package' | 'plan'
  id: string
  title: string
  subtitle: string
  price: number
  /** Сколько проверок начисляем после покупки. */
  checksAdded: number
  /** Имя плана — задаётся только для подписок. */
  planName?: string
}

/* Стартовый остаток проверок (демо). */
export const INITIAL_BALANCE = 3
export const FREE_PLAN = 'Бесплатный'

export const PACKAGES: CheckPackage[] = [
  { id: 'p1', checks: 1, price: 49, perCheck: 49 },
  { id: 'p5', checks: 5, price: 199, perCheck: 40, badge: 'выгодно', highlight: true },
  { id: 'p10', checks: 10, price: 349, perCheck: 35, badge: 'лучшая цена' },
]

export const PLANS: SubPlan[] = [
  {
    id: 'month',
    name: 'Месяц',
    period: 'месяц',
    price: 299,
    checksPerMonth: 30,
    features: ['30 проверок в месяц', 'Разбор по всем критериям', 'История проверок'],
  },
  {
    id: 'semester',
    name: 'Семестр',
    period: '6 месяцев',
    price: 1290,
    checksPerMonth: 60,
    badge: 'популярный',
    highlight: true,
    features: [
      '60 проверок в месяц',
      'Разбор по всем критериям',
      'Приоритетная проверка',
      'Доступ к базе аргументов',
    ],
  },
  {
    id: 'year',
    name: 'Год',
    period: 'год',
    price: 2190,
    checksPerMonth: 120,
    features: [
      '120 проверок в месяц',
      'Всё из тарифа «Семестр»',
      'Максимальная выгода на проверку',
    ],
  },
]

export const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'youmoney',
    label: 'ЮMoney',
    iconKey: 'youmoney',
    note: 'Оплата кошельком или картой через ЮMoney',
  },
  {
    id: 'tg_stars',
    label: 'Telegram Stars',
    iconKey: 'telegram',
    note: 'Оплата звёздами прямо в Telegram',
  },
]

/* Склонение слова «проверка» по числу: 1 проверка, 2 проверки, 5 проверок. */
export function pluralChecks(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'проверка'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'проверки'
  return 'проверок'
}

/* Скидка пакета относительно самого мелкого (для бейджа «выгода −N%»). */
export function packageDiscount(p: CheckPackage): number {
  const base = PACKAGES[0].perCheck
  if (p.perCheck >= base) return 0
  return Math.round((1 - p.perCheck / base) * 100)
}

export function packageToOffer(p: CheckPackage): PurchaseOffer {
  return {
    kind: 'package',
    id: p.id,
    title: `Пакет: ${p.checks} проверок`,
    subtitle: `${p.perCheck} ₽ за проверку`,
    price: p.price,
    checksAdded: p.checks,
  }
}

export function planToOffer(p: SubPlan): PurchaseOffer {
  return {
    kind: 'plan',
    id: p.id,
    title: `Подписка «${p.name}»`,
    subtitle: `${p.checksPerMonth} проверок в месяц · ${p.period}`,
    price: p.price,
    checksAdded: p.checksPerMonth,
    planName: p.name,
  }
}
