import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react'
import { Header } from './components/Header'
import { CheckPage } from './components/pages/CheckPage'
import { KnowledgePage } from './components/pages/KnowledgePage'
import { CounterPage } from './components/pages/CounterPage'
import { ProfilePage } from './components/pages/ProfilePage'
import { AuthPage } from './components/pages/AuthPage'
import { PricingPage } from './components/pages/PricingPage'
import { CheckoutPage } from './components/pages/CheckoutPage'
import { ProjectsPage } from './components/pages/ProjectsPage'
import { ToastHost, type ToastItem, type ToastKind } from './components/ui/Toast'
import type { Page } from './lib/nav'
import { FREE_PLAN, type PurchaseOffer } from './lib/billing'
import { api, type User } from './lib/api'

export function App() {
  const [page, setPage] = useState<Page>('check')
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const toastId = useRef(0)
  // Текущий пользователь (null — не авторизован). Приходит с сервера через api.auth.me().
  // Баланс проверок и название тарифа берём из него; пока бэка нет — null и нули.
  const [user, setUser] = useState<User | null>(null)
  // Выбранный для оплаты тариф (пакет или подписка).
  const [selectedOffer, setSelectedOffer] = useState<PurchaseOffer | null>(null)
  const reduce = useReducedMotion()
  const mainRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)

  const isAuthed = user !== null
  const balance = user?.balance ?? 0
  const planName = user?.plan ?? FREE_PLAN

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const notify = useCallback((text: string, kind: ToastKind = 'info') => {
    toastId.current += 1
    const id = toastId.current
    setToasts((list) => [...list.slice(-2), { id, text, kind }])
    window.setTimeout(() => dismiss(id), 3500)
  }, [dismiss])

  // Подтянуть пользователя с сервера. Тихо (без тоста): если не залогинен или
  // бэкенд не подключён — считаем гостем и показываем нули/пустые состояния.
  const refreshUser = useCallback(async () => {
    try {
      setUser(await api.auth.me())
    } catch {
      setUser(null)
    }
  }, [])

  // При загрузке приложения один раз проверяем сессию.
  useEffect(() => {
    void refreshUser()
  }, [refreshUser])

  // Вход/регистрация выполнены — сохраняем пользователя и ведём в профиль.
  const handleAuth = useCallback((u: User) => {
    setUser(u)
    setPage('profile')
  }, [])

  // Выбор тарифа → переход к оформлению.
  const buyOffer = useCallback((offer: PurchaseOffer) => {
    setSelectedOffer(offer)
    setPage('checkout')
  }, [])

  // Оплата подтверждена сервером без внешнего редиректа — обновляем баланс из профиля.
  const handlePaid = useCallback(async () => {
    setSelectedOffer(null)
    await refreshUser()
    notify('Оплата прошла — проверки начислены', 'success')
    setPage('profile')
  }, [refreshUser, notify])

  // Проверка списала баланс — отражаем новый остаток у авторизованного пользователя.
  const handleBalanceChange = useCallback((next: number) => {
    setUser((u) => (u ? { ...u, balance: next } : u))
  }, [])

  // При смене раздела: прокрутка наверх и перевод фокуса на контент
  // (чтобы скринридер начинал читать новый раздел сначала). Первый рендер
  // не трогаем — иначе фокус «уведёт» при загрузке страницы.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    mainRef.current?.focus({ preventScroll: true })
  }, [page, reduce])

  function renderPage() {
    switch (page) {
      case 'knowledge':
        return <KnowledgePage />
      case 'pricing':
        return (
          <PricingPage balance={balance} planName={planName} onBuy={buyOffer} />
        )
      case 'checkout':
        return (
          <CheckoutPage
            offer={selectedOffer}
            onToast={notify}
            onNavigate={setPage}
            onPaid={handlePaid}
          />
        )
      case 'projects':
        return <ProjectsPage />
      case 'counter':
        return <CounterPage />
      case 'profile':
        return (
          <ProfilePage
            user={user}
            onToast={notify}
            onNavigate={setPage}
            onLogout={() => setUser(null)}
            balance={balance}
            planName={planName}
          />
        )
      case 'auth':
        return (
          <AuthPage onToast={notify} onAuth={handleAuth} />
        )
      case 'check':
      default:
        return (
          <CheckPage
            onToast={notify}
            onNavigate={setPage}
            onBalanceChange={handleBalanceChange}
          />
        )
    }
  }

  const enter = reduce
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -10 },
      }

  return (
    <MotionConfig reducedMotion="user">
      <a className="skip-link" href="#main">
        К содержимому
      </a>
      <Header current={page} onNavigate={setPage} isAuthed={isAuthed} balance={balance} />

      <main id="main" ref={mainRef} tabIndex={-1} style={{ outline: 'none' }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={page}
            initial={enter.initial}
            animate={enter.animate}
            exit={enter.exit}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="container" style={footerStyle}>
        <span>ЕГЭ-чекер · проверка по критериям</span>
        <span>Английский · Русский</span>
      </footer>

      <ToastHost toasts={toasts} onDismiss={dismiss} />
    </MotionConfig>
  )
}

const footerStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingBlock: 28,
  marginTop: 20,
  borderTop: '2px solid var(--ink-faint)',
  color: 'var(--ink-faint)',
  fontSize: 13,
  fontWeight: 600,
}
