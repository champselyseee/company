import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Button } from '../ui/Button'
import {
  PACKAGES,
  PAYMENT_METHODS,
  PLANS,
  packageDiscount,
  packageToOffer,
  planToOffer,
  pluralChecks,
  type CheckPackage,
  type PurchaseOffer,
  type SubPlan,
} from '../../lib/billing'
import { IconBolt, IconCheck, IconSparkles, IconStar, IconTelegram } from '../../lib/icons'
import styles from './PricingPage.module.css'

type Mode = 'packages' | 'plans'

const FAQ = [
  {
    q: 'Как списываются проверки?',
    a: '1 проверка = 1 работа. После проверки сочинения или эссе остаток уменьшается на единицу.',
  },
  {
    q: 'Чем пакет отличается от подписки?',
    a: 'Пакет — разовая покупка проверок без срока. Подписка ежемесячно начисляет проверки и даёт доступ к доп-возможностям.',
  },
  {
    q: 'Можно ли вернуть деньги?',
    a: 'Да, возврат возможен по правилам сервиса — напишите в поддержку, и мы поможем с неиспользованными проверками.',
  },
]

export function PricingPage({
  balance,
  planName,
  onBuy,
}: {
  balance: number
  planName: string
  onBuy: (offer: PurchaseOffer) => void
}) {
  const reduce = useReducedMotion()
  const [mode, setMode] = useState<Mode>('packages')

  // Рекомендуемый пакет для финального призыва (выделенный, иначе средний).
  const featured = PACKAGES.find((p) => p.highlight) ?? PACKAGES[1] ?? PACKAGES[0]

  return (
    <div>
      {/* ── Геро ── */}
      <section className={`container ${styles.hero}`}>
        <span className={styles.eyebrow}>
          <IconSparkles size={15} /> Тарифы и пакеты
        </span>
        <h1 className={styles.h1}>Покупка проверок</h1>
        <p className={styles.lead}>
          Бери разовый пакет проверок или оформи подписку — и проверяй работы по критериям ЕГЭ
          без ограничений «одна бесплатно».
        </p>
      </section>

      {/* ── Остаток ── */}
      <section className={`container ${styles.balanceWrap}`}>
        <div className={styles.balanceCard}>
          <span className={styles.balanceIcon}>
            <IconBolt size={24} />
          </span>
          <div className={styles.balanceInfo}>
            <span className={styles.balanceLabel}>Осталось проверок</span>
            <span className={styles.balanceValue}>
              {balance} <span className={styles.balanceUnit}>{pluralChecks(balance)}</span>
            </span>
          </div>
          <div className={styles.balancePlan}>
            <span className={styles.balancePlanLabel}>Текущий план</span>
            <span className={styles.balancePlanValue}>{planName}</span>
          </div>
        </div>
      </section>

      {/* ── Переключатель ── */}
      <section className={`container ${styles.switchWrap}`}>
        <div className={styles.switch} role="tablist" aria-label="Тип покупки">
          {(['packages', 'plans'] as Mode[]).map((m) => {
            const active = mode === m
            return (
              <button
                key={m}
                role="tab"
                aria-selected={active}
                className={`${styles.switchBtn} ${active ? styles.switchActive : ''}`}
                onClick={() => setMode(m)}
              >
                {active && (
                  <motion.span
                    layoutId="pricing-switch"
                    className={styles.switchPill}
                    transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                  />
                )}
                <span className={styles.switchText}>{m === 'packages' ? 'Пакеты' : 'Подписка'}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Карточки ── */}
      <section className={`container ${styles.cardsWrap}`}>
        <div className={styles.cards}>
          {mode === 'packages'
            ? PACKAGES.map((p, i) => (
                <PackageCard key={p.id} pkg={p} index={i} reduce={reduce} onBuy={onBuy} />
              ))
            : PLANS.map((p, i) => (
                <PlanCard key={p.id} plan={p} index={i} reduce={reduce} onBuy={onBuy} />
              ))}
        </div>
      </section>

      {/* ── Способы оплаты ── */}
      <section className={`container ${styles.payWrap}`}>
        <span className={styles.payLabel}>Принимаем оплату</span>
        <div className={styles.payMethods}>
          {PAYMENT_METHODS.map((m) => (
            <span key={m.id} className={styles.payMethod}>
              <span className={styles.payIcon} aria-hidden="true">
                {m.iconKey === 'telegram' ? <IconTelegram size={18} /> : <b>Ю</b>}
              </span>
              {m.label}
            </span>
          ))}
        </div>
        <p className={styles.payNote}>
          Оплата через защищённое соединение. Проверки зачисляются сразу после оплаты.
        </p>
      </section>

      {/* ── FAQ ── */}
      <section className={`container ${styles.faqWrap}`}>
        <h2 className={styles.h2}>Частые вопросы</h2>
        <div className={styles.faq}>
          {FAQ.map((f) => (
            <div key={f.q} className={styles.faqItem}>
              <h3 className={styles.faqQ}>{f.q}</h3>
              <p className={styles.faqA}>{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Финальный призыв ── */}
      <section className={`container ${styles.finalWrap}`}>
        <div className={styles.final}>
          <div>
            <h2 className={styles.finalTitle}>Готов начать?</h2>
            <p className={styles.finalText}>
              Популярный выбор — пакет на {featured.checks} {pluralChecks(featured.checks)}: дешевле
              за проверку, чем поштучно.
            </p>
          </div>
          <Button
            size="lg"
            leading={<IconStar size={20} />}
            onClick={() => onBuy(packageToOffer(featured))}
          >
            Взять {featured.checks} {pluralChecks(featured.checks)}
          </Button>
        </div>
      </section>
    </div>
  )
}

function PackageCard({
  pkg,
  index,
  reduce,
  onBuy,
}: {
  pkg: CheckPackage
  index: number
  reduce: boolean | null
  onBuy: (offer: PurchaseOffer) => void
}) {
  const discount = packageDiscount(pkg)
  return (
    <motion.div
      className={`${styles.card} ${pkg.highlight ? styles.cardHot : ''}`}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      {pkg.badge && <span className={styles.cardBadge}>{pkg.badge}</span>}
      <span className={styles.cardKicker}>Пакет</span>
      <span className={styles.cardChecks}>
        {pkg.checks} <span className={styles.cardChecksUnit}>{pluralChecks(pkg.checks)}</span>
      </span>
      <span className={styles.cardPrice}>{pkg.price.toLocaleString('ru-RU')} ₽</span>
      <span className={styles.cardPer}>
        {pkg.perCheck} ₽ за проверку
        {discount > 0 && <span className={styles.cardSave}>выгода −{discount}%</span>}
      </span>
      <Button
        fullWidth
        className={styles.cardBtn}
        variant={pkg.highlight ? 'primary' : 'secondary'}
        onClick={() => onBuy(packageToOffer(pkg))}
      >
        Купить
      </Button>
    </motion.div>
  )
}

function PlanCard({
  plan,
  index,
  reduce,
  onBuy,
}: {
  plan: SubPlan
  index: number
  reduce: boolean | null
  onBuy: (offer: PurchaseOffer) => void
}) {
  return (
    <motion.div
      className={`${styles.card} ${plan.highlight ? styles.cardHot : ''}`}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      {plan.badge && <span className={styles.cardBadge}>{plan.badge}</span>}
      <span className={styles.cardKicker}>Подписка</span>
      <span className={styles.cardName}>{plan.name}</span>
      <span className={styles.cardPrice}>
        {plan.price.toLocaleString('ru-RU')} ₽
        <span className={styles.cardPeriod}>/ {plan.period}</span>
      </span>
      <ul className={styles.featList}>
        {plan.features.map((f) => (
          <li key={f} className={styles.feat}>
            <span className={styles.featMark} aria-hidden="true">
              <IconCheck size={14} />
            </span>
            {f}
          </li>
        ))}
      </ul>
      <Button
        fullWidth
        className={styles.cardBtn}
        variant={plan.highlight ? 'primary' : 'secondary'}
        onClick={() => onBuy(planToOffer(plan))}
      >
        Оформить
      </Button>
    </motion.div>
  )
}
