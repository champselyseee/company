import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { NAV_ITEMS, type Page } from '../lib/nav'
import { useCountUp } from '../lib/useCountUp'
import {
  IconBolt,
  IconBook,
  IconCalendar,
  IconCheck,
  IconClose,
  IconLogin,
  IconMenu,
  IconStar,
  IconTelegram,
  IconUser,
} from '../lib/icons'
import styles from './Header.module.css'

const NAV_ICONS = {
  check: IconCheck,
  book: IconBook,
  star: IconStar,
  telegram: IconTelegram,
  calendar: IconCalendar,
  user: IconUser,
}

/* «Профиль» выводим отдельным аккаунт-блоком у правого края. Остальные разделы —
   в порядке NAV_ITEMS, «Telegram-бот» последним. */
const SECTION_ITEMS = NAV_ITEMS.filter((i) => i.id !== 'profile')

/** Зачисление, которое сейчас анимируется на чипе баланса (id — чтобы различать подряд идущие). */
export interface CreditPulse {
  id: number
  from: number
  to: number
}

/* Чип баланса ⚡N. При зачислении (credit) число докручивается от старого к новому,
   чип подпрыгивает, а над ним всплывает «+N». Анимируется обёртка, а не сама кнопка —
   чтобы не сломать «нажатие» кнопки (сдвиг через CSS transform). */
function BalanceChip({
  balance,
  credit,
  className,
  onClick,
}: {
  balance: number
  credit: CreditPulse | null
  className: string
  onClick: () => void
}) {
  const shown = useCountUp(balance, 1100, credit !== null, credit?.from ?? 0)
  const delta = credit ? credit.to - credit.from : 0
  return (
    <motion.span
      className={styles.chipWrap}
      animate={credit ? { scale: [1, 1.22, 0.94, 1.06, 1], rotate: [0, -5, 4, -1, 0] } : { scale: 1, rotate: 0 }}
      transition={{ duration: 0.9, ease: 'easeOut' }}
    >
      <button
        className={`${className} ${credit ? styles.chipCredited : ''}`}
        onClick={onClick}
        aria-label={`Осталось ${balance} проверок — открыть тарифы`}
      >
        <IconBolt size={16} />
        <b>{shown}</b>
      </button>
      <AnimatePresence>
        {credit && delta > 0 && (
          <motion.span
            key={credit.id}
            className={styles.creditFloat}
            aria-hidden="true"
            initial={{ opacity: 0, y: 6, scale: 0.5 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.35 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 18 }}
          >
            +{delta}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.span>
  )
}

export function Header({
  current,
  onNavigate,
  isAuthed,
  balance,
  credit = null,
}: {
  current: Page
  onNavigate: (p: Page) => void
  isAuthed: boolean
  balance: number
  credit?: CreditPulse | null
}) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  // Зачисление — показываем спрятанную шапку, иначе анимацию на чипе никто не увидит.
  useEffect(() => {
    if (credit) setScrolled(false)
  }, [credit])

  /* Прячущаяся шапка: при прокрутке вниз скрываем всю плашку (она уезжает вверх
     и растворяется), при прокрутке вверх и у самого верха — показываем целиком.
     Когда меню открыто — шапка видна. */
  useEffect(() => {
    let lastY = window.scrollY
    function onScroll() {
      const y = window.scrollY
      if (open || y < 12) {
        setScrolled(false)
        lastY = y
        return
      }
      if (y > lastY + 4) setScrolled(true)
      else if (y < lastY - 4) setScrolled(false)
      lastY = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [open])

  /* Когда шапка спрятана — убираем и фиксированную «крышку» (body::before):
     иначе сверху осталась бы бежевая полоса вместо контента. Класс на <body>
     цепляет правило body.header-hidden::before в index.css. */
  useEffect(() => {
    document.body.classList.toggle('header-hidden', scrolled)
    return () => document.body.classList.remove('header-hidden')
  }, [scrolled])

  function go(p: Page) {
    onNavigate(p)
    setOpen(false)
  }

  const profileActive = current === 'profile'

  return (
    <>
      <header className={`${styles.header} ${scrolled ? styles.headerHidden : ''}`}>
        <div className={`container ${styles.inner}`}>
          {/* Логотип — часть прячущейся плашки (двигается вместе с ней) */}
          <button
            className={styles.brand}
            onClick={() => go('check')}
            aria-label="На главную"
          >
            <img className={styles.mark} src="/bear.png" alt="" aria-hidden="true" />
            <span className={styles.brandText}>
              ЕГЭ<span className={styles.brandAccent}> Тьютор</span>
            </span>
          </button>

          {/* Десктоп-навигация: разделы, аккаунт-блок — у правого края */}
          <nav
            className={`${styles.nav} ${isAuthed ? styles.navCompact : ''}`}
            aria-label="Основная навигация"
          >
            {SECTION_ITEMS.map((item) => {
              const Icon = NAV_ICONS[item.iconKey]
              const active = current === item.id
              return (
                <button
                  key={item.id}
                  className={`${styles.navItem} ${active ? styles.active : ''}`}
                  onClick={() => go(item.id)}
                  aria-current={active ? 'page' : undefined}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className={styles.pill}
                      transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                    />
                  )}
                  <span className={styles.navIcon}>
                    <Icon size={18} />
                  </span>
                  <span className={styles.navLabel}>{item.label}</span>
                </button>
              )
            })}

            {/* Баланс проверок (только для вошедших) — на мобайле он в чипах справа */}
            {isAuthed && (
              <BalanceChip
                balance={balance}
                credit={credit}
                className={`${styles.chipBalance} ${styles.chipBalanceNav}`}
                onClick={() => go('pricing')}
              />
            )}

            {/* Аккаунт: «Профиль» (+ сегмент «Войти», пока не авторизован) */}
            {isAuthed ? (
              <button
                className={`${styles.navItem} ${profileActive ? styles.active : ''}`}
                onClick={() => go('profile')}
                aria-current={profileActive ? 'page' : undefined}
              >
                <span className={styles.navIcon}>
                  <IconUser size={18} />
                </span>
                <span className={styles.navLabel}>Профиль</span>
              </button>
            ) : (
              <div className={styles.account}>
                <button
                  className={`${styles.accountBtn} ${styles.accountProfile} ${
                    profileActive ? styles.accountActive : ''
                  }`}
                  onClick={() => go('profile')}
                  aria-current={profileActive ? 'page' : undefined}
                >
                  <IconUser size={18} />
                  <span>Профиль</span>
                </button>
                <button
                  className={`${styles.accountBtn} ${styles.accountLogin}`}
                  onClick={() => go('auth')}
                  aria-label="Войти"
                >
                  <IconLogin size={18} />
                </button>
              </div>
            )}
          </nav>

          {/* Чипы на плашке (мобайл): баланс проверок + меню */}
          <div className={styles.chips}>
            <BalanceChip
              balance={balance}
              credit={credit}
              className={styles.chipBalance}
              onClick={() => go('pricing')}
            />
            <button
              className={styles.chipBurger}
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
            >
              {open ? <IconClose size={22} /> : <IconMenu size={22} />}
            </button>
          </div>
        </div>
      </header>

      {/* Мобильное выпадающее меню */}
      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.mobileMenu}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={`container ${styles.mobileInner}`}>
              {/* Аккаунт: «Профиль» + сегмент «Войти» */}
              {isAuthed ? (
                <button
                  className={`${styles.mobileItem} ${profileActive ? styles.mobileActive : ''}`}
                  onClick={() => go('profile')}
                  aria-current={profileActive ? 'page' : undefined}
                >
                  <IconUser size={20} />
                  <span>Профиль</span>
                </button>
              ) : (
                <div className={styles.mAccount}>
                  <button
                    className={`${styles.mAccountProfile} ${
                      profileActive ? styles.mAccountActive : ''
                    }`}
                    onClick={() => go('profile')}
                    aria-current={profileActive ? 'page' : undefined}
                  >
                    <IconUser size={20} />
                    <span>Профиль</span>
                  </button>
                  <button
                    className={styles.mAccountLogin}
                    onClick={() => go('auth')}
                    aria-label="Войти"
                  >
                    <IconLogin size={20} />
                  </button>
                </div>
              )}

              {/* Разделы */}
              {SECTION_ITEMS.map((item) => {
                const Icon = NAV_ICONS[item.iconKey]
                const active = current === item.id
                return (
                  <button
                    key={item.id}
                    className={`${styles.mobileItem} ${active ? styles.mobileActive : ''}`}
                    onClick={() => go(item.id)}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
