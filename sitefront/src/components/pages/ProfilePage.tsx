import { motion, useReducedMotion } from 'motion/react'
import { Button } from '../ui/Button'
import { SectionLabel } from '../ui/SectionLabel'
import {
  ACHIEVEMENTS,
  PROFILE,
  PROFILE_STATS,
  RECENT_CHECKS,
} from '../../lib/profile'
import {
  IconArrowRight,
  IconBolt,
  IconBook,
  IconChevron,
  IconFlame,
  IconLogout,
  IconMail,
  IconPen,
  IconPen as IconEdit,
  IconStar,
  IconTarget,
  IconTrophy,
} from '../../lib/icons'
import type { ToastKind } from '../ui/Toast'
import type { Page } from '../../lib/nav'
import { pluralChecks } from '../../lib/billing'
import styles from './ProfilePage.module.css'

const STAT_ICONS = { target: IconTarget, bolt: IconBolt, flame: IconFlame, star: IconStar }
const WORK_ICONS = { mail: IconMail, pen: IconPen, book: IconBook }
const ACH_ICONS = { trophy: IconTrophy, flame: IconFlame, star: IconStar, bolt: IconBolt }

export function ProfilePage({
  onToast,
  onNavigate,
  onLogout,
  balance,
  planName,
}: {
  onToast: (text: string, kind?: ToastKind) => void
  onNavigate: (p: Page) => void
  onLogout: () => void
  balance: number
  planName: string
}) {
  const reduce = useReducedMotion()
  const initials = PROFILE.name
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className={`container ${styles.page}`}>
      {/* Шапка профиля */}
      <motion.div
        className={styles.head}
        initial={reduce ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 24 }}
      >
        <div className={styles.avatar} aria-hidden="true">
          {initials}
        </div>
        <div className={styles.headInfo}>
          <h1 className={styles.name}>{PROFILE.name}</h1>
          <p className={styles.email}>
            <IconMail size={15} /> {PROFILE.email}
          </p>
          <div className={styles.tags}>
            <span className={styles.tag}>{planName}</span>
            <span className={styles.tagMuted}>{PROFILE.joined}</span>
          </div>
        </div>
        <Button
          variant="secondary"
          leading={<IconEdit size={18} />}
          onClick={() => onToast('Редактирование появится в полной версии', 'info')}
        >
          Редактировать
        </Button>
      </motion.div>

      {/* Баланс проверок */}
      <div className={styles.balanceCard}>
        <span className={styles.balanceIcon}>
          <IconBolt size={24} />
        </span>
        <div className={styles.balanceInfo}>
          <span className={styles.balanceLabel}>Остаток проверок</span>
          <span className={styles.balanceValue}>
            {balance} <span className={styles.balanceUnit}>{pluralChecks(balance)}</span>
          </span>
          <span className={styles.balancePlan}>Тариф: {planName}</span>
        </div>
        <Button onClick={() => onNavigate('pricing')} trailing={<IconArrowRight size={18} />}>
          Пополнить
        </Button>
      </div>

      {/* Статистика */}
      <SectionLabel hint="заглушка" style={{ marginTop: 32 }}>
        Статистика
      </SectionLabel>
      <div className={styles.stats}>
        {PROFILE_STATS.map((s, i) => {
          const Icon = STAT_ICONS[s.iconKey]
          return (
            <motion.div
              key={s.label}
              className={styles.statCard}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
            >
              <span className={styles.statIcon}>
                <Icon size={20} />
              </span>
              <span className={styles.statValue}>{s.value}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </motion.div>
          )
        })}
      </div>

      <div className={styles.twoCol}>
        {/* Последние проверки */}
        <div>
          <SectionLabel hint="последние">История проверок</SectionLabel>
          <div className={styles.recentList}>
            {RECENT_CHECKS.map((r) => {
              const Icon = WORK_ICONS[r.iconKey]
              return (
                <button
                  key={r.id}
                  className={styles.recent}
                  onClick={() => onToast('Открытие работы — в полной версии', 'info')}
                >
                  <span className={styles.recentIcon}>
                    <Icon size={18} />
                  </span>
                  <span className={styles.recentBody}>
                    <span className={styles.recentTitle}>{r.title}</span>
                    <span className={styles.recentDate}>{r.date}</span>
                  </span>
                  <span className={styles.recentScore}>{r.score}</span>
                  <span className={styles.recentChevron}>
                    <IconChevron size={18} />
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Достижения */}
        <div>
          <SectionLabel hint="бейджи">Достижения</SectionLabel>
          <div className={styles.achGrid}>
            {ACHIEVEMENTS.map((a) => {
              const Icon = ACH_ICONS[a.iconKey]
              return (
                <div
                  key={a.id}
                  className={`${styles.ach} ${a.unlocked ? '' : styles.achLocked}`}
                >
                  <span className={styles.achIcon}>
                    <Icon size={22} />
                  </span>
                  <span className={styles.achTitle}>{a.title}</span>
                  <span className={styles.achDesc}>{a.desc}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Выход — намеренно отделён от остального */}
      <div className={styles.dangerZone}>
        <button
          className={styles.logout}
          onClick={() => {
            onLogout()
            onToast('Вы вышли из аккаунта (демо)', 'success')
            onNavigate('auth')
          }}
        >
          <IconLogout size={18} /> Выйти из аккаунта
        </button>
      </div>
    </div>
  )
}
