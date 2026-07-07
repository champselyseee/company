import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Button } from '../ui/Button'
import { SectionLabel } from '../ui/SectionLabel'
import { PROFILE_STAT_TILES, ACHIEVEMENTS, type StatTileMeta } from '../../lib/profile'
import { WORK_TYPES } from '../../lib/workTypes'
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
import { api, type HistoryItem, type ProfileStats, type User } from '../../lib/api'
import styles from './ProfilePage.module.css'

const STAT_ICONS = { target: IconTarget, bolt: IconBolt, flame: IconFlame, star: IconStar }
const WORK_ICONS = { mail: IconMail, pen: IconPen, book: IconBook }
const ACH_ICONS = { trophy: IconTrophy, flame: IconFlame, star: IconStar, bolt: IconBolt }

// Значение плитки статистики. Пока данных нет — нули/прочерки.
function statValue(key: StatTileMeta['key'], stats: ProfileStats | null): string {
  if (!stats) return key === 'averagePercent' || key === 'bestScore' ? '—' : '0'
  switch (key) {
    case 'worksChecked':
      return String(stats.worksChecked)
    case 'averagePercent':
      return stats.averagePercent == null ? '—' : `${stats.averagePercent}%`
    case 'streakDays':
      return String(stats.streakDays)
    case 'bestScore':
      return stats.bestScore ?? '—'
  }
}

// «14 июня» из ISO-даты.
function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

// «с март 2026» из ISO-даты регистрации.
function formatJoined(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `с ${d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}`
}

function initialsOf(user: User | null): string {
  const source = user?.displayName || user?.email || ''
  const letters = source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return letters || '—'
}

export function ProfilePage({
  user,
  onToast,
  onNavigate,
  onLogout,
  balance,
  planName,
}: {
  user: User | null
  onToast: (text: string, kind?: ToastKind) => void
  onNavigate: (p: Page) => void
  onLogout: () => void
  balance: number
  planName: string
}) {
  const reduce = useReducedMotion()
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [unlocked, setUnlocked] = useState<string[]>([])
  // null — ещё грузим/неизвестно; [] — точно пусто (показываем пустое состояние).
  const [history, setHistory] = useState<HistoryItem[] | null>(null)

  // Подтягиваем статистику и историю с сервера. Пока бэка нет — тихо остаёмся
  // на нулях и пустом списке (пользователь не видит ошибок).
  useEffect(() => {
    let alive = true
    api.profile
      .getProfile()
      .then((p) => {
        if (!alive) return
        setStats(p.stats)
        setUnlocked(p.unlockedAchievements)
      })
      .catch(() => {})
    api.checks
      .getHistory()
      .then((h) => alive && setHistory(h))
      .catch(() => alive && setHistory([]))
    return () => {
      alive = false
    }
  }, [])

  const name = user?.displayName || 'Профиль'
  const joined = formatJoined(user?.joinedAt ?? null)

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
          {initialsOf(user)}
        </div>
        <div className={styles.headInfo}>
          <h1 className={styles.name}>{name}</h1>
          {user?.email && (
            <p className={styles.email}>
              <IconMail size={15} /> {user.email}
            </p>
          )}
          <div className={styles.tags}>
            <span className={styles.tag}>{planName}</span>
            {joined && <span className={styles.tagMuted}>{joined}</span>}
          </div>
        </div>
        <Button
          variant="secondary"
          leading={<IconEdit size={18} />}
          onClick={() => onToast('Редактирование профиля скоро появится', 'info')}
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
      <SectionLabel hint="за всё время" style={{ marginTop: 32 }}>
        Статистика
      </SectionLabel>
      <div className={styles.stats}>
        {PROFILE_STAT_TILES.map((s, i) => {
          const Icon = STAT_ICONS[s.iconKey]
          return (
            <motion.div
              key={s.key}
              className={styles.statCard}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
            >
              <span className={styles.statIcon}>
                <Icon size={20} />
              </span>
              <span className={styles.statValue}>{statValue(s.key, stats)}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </motion.div>
          )
        })}
      </div>

      <div className={styles.twoCol}>
        {/* Последние проверки */}
        <div>
          <SectionLabel hint="последние">История проверок</SectionLabel>
          {history && history.length === 0 ? (
            <p className={styles.emptyHint}>
              Здесь появятся ваши проверки. Начните с первой работы на главной.
            </p>
          ) : (
            <div className={styles.recentList}>
              {(history ?? []).map((r) => {
                const Icon = WORK_ICONS[WORK_TYPES[r.workType].iconKey]
                return (
                  <button
                    key={r.id}
                    className={styles.recent}
                    onClick={() => onToast('Открытие прошлой работы скоро появится', 'info')}
                  >
                    <span className={styles.recentIcon}>
                      <Icon size={18} />
                    </span>
                    <span className={styles.recentBody}>
                      <span className={styles.recentTitle}>{r.title}</span>
                      <span className={styles.recentDate}>{formatDate(r.createdAt)}</span>
                    </span>
                    <span className={styles.recentScore}>
                      {r.score}/{r.maxScore}
                    </span>
                    <span className={styles.recentChevron}>
                      <IconChevron size={18} />
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Достижения */}
        <div>
          <SectionLabel hint="бейджи">Достижения</SectionLabel>
          <div className={styles.achGrid}>
            {ACHIEVEMENTS.map((a) => {
              const Icon = ACH_ICONS[a.iconKey]
              const isUnlocked = unlocked.includes(a.id)
              return (
                <div
                  key={a.id}
                  className={`${styles.ach} ${isUnlocked ? '' : styles.achLocked}`}
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
          onClick={async () => {
            try {
              await api.auth.logout()
            } catch {
              /* даже если сервер недоступен — выходим локально */
            }
            onLogout()
            onToast('Вы вышли из аккаунта', 'success')
            onNavigate('auth')
          }}
        >
          <IconLogout size={18} /> Выйти из аккаунта
        </button>
      </div>
    </div>
  )
}
