import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Button } from '../ui/Button'
import {
  IconArrowRight,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconGoogle,
  IconKey,
  IconMail,
  IconSparkles,
  IconTelegram,
  IconUser,
} from '../../lib/icons'
import type { ToastKind } from '../ui/Toast'
import { api, errorMessage, type User } from '../../lib/api'
import styles from './AuthPage.module.css'

type Mode = 'login' | 'register'

const PERKS = [
  'Разбор по каждому критерию ЕГЭ',
  'Английский и русский в одном месте',
  'История проверок и прогресс',
  'Счётчик дней до экзамена',
]

export function AuthPage({
  onToast,
  onAuth,
}: {
  onToast: (text: string, kind?: ToastKind) => void
  onAuth: (user: User) => void
}) {
  const reduce = useReducedMotion()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string; name?: string }>({})

  function validate() {
    const e: typeof errors = {}
    if (mode === 'register' && name.trim().length < 2) e.name = 'Введите имя'
    if (!/^\S+@\S+\.\S+$/.test(email)) e.email = 'Введите корректную почту'
    if (password.length < 6) e.password = 'Минимум 6 символов'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    if (!validate()) {
      onToast('Проверьте поля формы', 'error')
      return
    }
    setSubmitting(true)
    try {
      const { user } =
        mode === 'login'
          ? await api.auth.login({ email, password })
          : await api.auth.register({ email, password, name })
      onToast(mode === 'login' ? 'Вход выполнен' : 'Аккаунт создан', 'success')
      onAuth(user)
    } catch (e) {
      onToast(errorMessage(e), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Восстановление пароля по почте.
  async function forgot() {
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      onToast('Введите почту, на которую придёт ссылка', 'info')
      return
    }
    try {
      await api.auth.forgotPassword(email)
      onToast('Отправили ссылку для восстановления на почту', 'success')
    } catch (e) {
      onToast(errorMessage(e), 'error')
    }
  }

  // Вход через сторонний сервис: уводим на бэкенд. Если он не подключён — подсказка.
  function social(provider: 'google' | 'telegram') {
    if (!api.auth.startOAuth(provider)) {
      onToast('Этот способ входа станет доступен после подключения сервера', 'info')
    }
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.layout}>
        {/* Декоративная панель (десктоп) */}
        <motion.aside
          className={styles.aside}
          initial={reduce ? false : { opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 24 }}
          aria-hidden="true"
        >
          <span className={styles.asideMark}>
            <IconCheck size={26} />
          </span>
          <h2 className={styles.asideTitle}>
            Готовься к ЕГЭ
            <br />
            с проверкой за минуту
          </h2>
          <ul className={styles.perks}>
            {PERKS.map((p) => (
              <li key={p} className={styles.perk}>
                <span className={styles.perkDot}>
                  <IconCheck size={14} />
                </span>
                {p}
              </li>
            ))}
          </ul>
          <div className={styles.asideSticker}>
            <IconSparkles size={18} /> 12 480+ проверок
          </div>
        </motion.aside>

        {/* Форма */}
        <motion.div
          className={styles.formCard}
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 24, delay: 0.05 }}
        >
          {/* Переключатель режимов */}
          <div className={styles.tabs} role="tablist" aria-label="Вход или регистрация">
            <button
              role="tab"
              aria-selected={mode === 'login'}
              className={`${styles.tab} ${mode === 'login' ? styles.tabActive : ''}`}
              onClick={() => setMode('login')}
            >
              {mode === 'login' && (
                <motion.span layoutId="auth-tab" className={styles.tabPill} />
              )}
              <span className={styles.tabText}>Вход</span>
            </button>
            <button
              role="tab"
              aria-selected={mode === 'register'}
              className={`${styles.tab} ${mode === 'register' ? styles.tabActive : ''}`}
              onClick={() => setMode('register')}
            >
              {mode === 'register' && (
                <motion.span layoutId="auth-tab" className={styles.tabPill} />
              )}
              <span className={styles.tabText}>Регистрация</span>
            </button>
          </div>

          <form className={styles.form} onSubmit={submit} noValidate>
            {mode === 'register' && (
              <Field
                id="auth-name"
                label="Имя"
                icon={<IconUser size={18} />}
                error={errors.name}
              >
                <input
                  id="auth-name"
                  className={styles.input}
                  type="text"
                  autoComplete="name"
                  placeholder="Как тебя зовут"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={!!errors.name}
                />
              </Field>
            )}

            <Field id="auth-email" label="Почта" icon={<IconMail size={18} />} error={errors.email}>
              <input
                id="auth-email"
                className={styles.input}
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!errors.email}
              />
            </Field>

            <Field
              id="auth-pass"
              label="Пароль"
              icon={<IconKey size={18} />}
              error={errors.password}
              trailing={
                <button
                  type="button"
                  className={styles.peek}
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  {showPass ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                </button>
              }
            >
              <input
                id="auth-pass"
                className={styles.input}
                type={showPass ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="Минимум 6 символов"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!errors.password}
              />
            </Field>

            {mode === 'login' && (
              <button type="button" className={styles.forgot} onClick={forgot}>
                Забыли пароль?
              </button>
            )}

            <Button
              fullWidth
              size="lg"
              type="submit"
              disabled={submitting}
              trailing={submitting ? undefined : <IconArrowRight size={20} />}
            >
              {submitting
                ? mode === 'login'
                  ? 'Входим…'
                  : 'Создаём…'
                : mode === 'login'
                  ? 'Войти'
                  : 'Создать аккаунт'}
            </Button>
          </form>

          <div className={styles.divider}>
            <span>или</span>
          </div>

          <div className={styles.social}>
            <button className={styles.socialBtn} onClick={() => social('telegram')}>
              <IconTelegram size={20} /> Продолжить с Telegram
            </button>
            <button className={styles.socialBtn} onClick={() => social('google')}>
              <IconGoogle size={20} /> Продолжить с Google
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function Field({
  id,
  label,
  icon,
  error,
  trailing,
  children,
}: {
  id: string
  label: string
  icon: ReactNode
  error?: string
  trailing?: ReactNode
  children: ReactNode
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={`${styles.inputWrap} ${error ? styles.inputError : ''}`}>
        <span className={styles.inputIcon}>{icon}</span>
        {children}
        {trailing}
      </div>
      {error && (
        <span className={styles.errorMsg} role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
