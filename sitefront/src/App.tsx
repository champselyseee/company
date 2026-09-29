import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react'
import { Header, type CreditPulse } from './components/Header'
import { PaymentBanner } from './components/PaymentBanner'
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
import { api, type CreatePaymentResponse, type User } from './lib/api'
import { usePaymentWatcher } from './lib/usePaymentWatcher'

export function App() {
  const [page, setPage] = useState<Page>('check')
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const toastId = useRef(0)
  // Текущий пользователь (null — не авторизован). Приходит с сервера через api.auth.me().
  // Баланс проверок и название тарифа берём из него; пока бэка нет — null и нули.
  const [user, setUser] = useState<User | null>(null)
  // Выбранный для оплаты тариф (пакет или подписка).
  const [selectedOffer, setSelectedOffer] = useState<PurchaseOffer | null>(null)
  // С какой вкладки открыть страницу авторизации: «Вход» или «Регистрация».
  // Меняется, когда гость жмёт кнопку из блока-приглашения на главной.
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  // Зачисление после оплаты, которое сейчас анимируется на чипе баланса в шапке.
  const [credit, setCredit] = useState<CreditPulse | null>(null)
  const creditId = useRef(0)
  // Меняется после зачисления — профиль перезагружает историю покупок.
  const [purchasesVersion, setPurchasesVersion] = useState(0)
  const reduce = useReducedMotion()
  const mainRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)

  const isAuthed = user !== null
  const balance = user?.balance ?? 0
  const planName = user?.plan ?? FREE_PLAN

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const notify = useCallback((text: string, kind: ToastKind = 'info', durationMs = 3500) => {
    toastId.current += 1
    const id = toastId.current
    setToasts((list) => [...list.slice(-2), { id, text, kind }])
    window.setTimeout(() => dismiss(id), durationMs)
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

  // Проверки зачислены: баланс в шапке докручивается from → to, чип подпрыгивает,
  // внизу — уведомление. Потом подтягиваем пользователя целиком (мог смениться тариф).
  const showCredit = useCallback(
    (from: number, to: number, title: string) => {
      creditId.current += 1
      const id = creditId.current
      setUser((u) => (u ? { ...u, balance: to } : u))
      setCredit({ id, from, to })
      setPurchasesVersion((v) => v + 1)
      notify(title ? `Оплата прошла: ${title}` : 'Оплата прошла — проверки зачислены', 'success', 6000)
      window.setTimeout(() => setCredit((c) => (c?.id === id ? null : c)), 2600)
      void refreshUser()
    },
    [notify, refreshUser],
  )

  // Вернулись со страницы оплаты — ждём зачисления (плашка + опрос статуса).
  const payment = usePaymentWatcher(isAuthed, (c) => showCredit(c.from, c.to, c.title))

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

  // Открыть авторизацию на нужной вкладке (из блока-приглашения на главной).
  const goAuth = useCallback((mode: 'login' | 'register') => {
    setAuthMode(mode)
    setPage('auth')
  }, [])

  // Оплата подтверждена сервером сразу, без внешнего редиректа (режим-заглушка) —
  // та же анимация зачисления, что и после ЮKassa.
  const handlePaid = useCallback(
    async (res: CreatePaymentResponse) => {
      setSelectedOffer(null)
      setPage('profile')
      if (typeof res.balance === 'number') {
        showCredit(balance, res.balance, res.title ?? '')
      } else {
        await refreshUser()
        notify('Оплата прошла — проверки начислены', 'success')
      }
    },
    [balance, showCredit, refreshUser, notify],
  )

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
            balance={balance}
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
            purchasesVersion={purchasesVersion}
          />
        )
      case 'auth':
        return (
          <AuthPage onToast={notify} onAuth={handleAuth} initialMode={authMode} />
        )
      case 'check':
      default:
        return (
          <CheckPage
            onToast={notify}
            onNavigate={setPage}
            onBalanceChange={handleBalanceChange}
            isAuthed={isAuthed}
            onAuth={goAuth}
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
      <Header
        current={page}
        onNavigate={setPage}
        isAuthed={isAuthed}
        balance={balance}
        credit={credit}
      />

      <PaymentBanner
        phase={payment.phase}
        onDismiss={payment.dismiss}
        onPricing={() => {
          payment.dismiss()
          setPage('pricing')
        }}
      />

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
