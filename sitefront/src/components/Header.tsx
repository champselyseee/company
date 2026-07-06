import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { NAV_ITEMS, type Page } from '../lib/nav'
import {
  IconBolt,
  IconBook,
  IconCalendar,
  IconCheck,
  IconClose,
  IconGrid,
  IconLogin,
  IconMenu,
  IconStar,
  IconUser,
} from '../lib/icons'
import styles from './Header.module.css'

const NAV_ICONS = {
  check: IconCheck,
  book: IconBook,
  star: IconStar,
  grid: IconGrid,
  calendar: IconCalendar,
  user: IconUser,
}

/* «Профиль» выводим отдельным аккаунт-блоком. На десктопе он уезжает в правый
   край, а «Наши проекты» встаёт первым (они меняются местами). */
const SECTION_ITEMS = NAV_ITEMS.filter((i) => i.id !== 'profile')
const DESKTOP_SECTIONS = [
  ...SECTION_ITEMS.filter((i) => i.id === 'projects'),
  ...SECTION_ITEMS.filter((i) => i.id !== 'projects'),
]

export function Header({
  current,
  onNavigate,
  isAuthed,
  balance,
}: {
  current: Page
  onNavigate: (p: Page) => void
  isAuthed: boolean
  balance: number
}) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

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
            <span className={styles.mark} aria-hidden="true">
              <IconCheck size={20} />
            </span>
            <span className={styles.brandText}>
              ЕГЭ<span className={styles.brandAccent}>-чекер</span>
            </span>
          </button>

          {/* Десктоп-навигация: разделы, аккаунт-блок — у правого края */}
          <nav className={styles.nav} aria-label="Основная навигация">
            {DESKTOP_SECTIONS.map((item) => {
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
            <button
              className={styles.chipBalance}
              onClick={() => go('pricing')}
              aria-label={`Осталось ${balance} проверок — открыть тарифы`}
            >
              <IconBolt size={16} />
              <b>{balance}</b>
            </button>
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
