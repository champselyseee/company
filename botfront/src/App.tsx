import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { AttachedFile, Screen, WorkType } from './lib/types'
import { URL_TOKEN } from './lib/config'
import { checkToken, submitProxy } from './lib/api'
import { notify } from './lib/telegram'
import { DEMO_RESULTS, getDemoType } from './lib/demo'
import { CheckingScreen } from './components/screens/CheckingScreen'
import { NoAccessScreen } from './components/screens/NoAccessScreen'
import { LoadingScreen } from './components/screens/LoadingScreen'
import { FormScreen, type FormState } from './components/screens/FormScreen'
import { ResultScreen } from './components/screens/ResultScreen'
import { MIN_TEXT_LENGTH } from './lib/config'

const NO_TOKEN_MSG = 'Ссылка устарела или повреждена.\nНажми /start в боте для новой кнопки.'
const USED_TOKEN_MSG =
  'Сессия истекла или уже использована.\nДожидайся новой кнопки от бота — она придёт автоматически после проверки.\nИли нажми /start чтобы получить новую.'
const SERVER_DOWN_MSG =
  'Сервер не отвечает (Railway cold start).\nЗакрой WebApp, подожди 30–60 сек и нажми кнопку снова.'

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function App() {
  const [screen, setScreen] = useState<Screen>('checking')
  const [checkingMessage, setCheckingMessage] = useState('Загружаем')
  const [noAccessMessage, setNoAccessMessage] = useState(USED_TOKEN_MSG)
  const [error, setError] = useState<{ text: string; id: number } | null>(null)
  const [result, setResult] = useState<{ text: string; type: WorkType } | null>(null)

  const [form, setForm] = useState<FormState>({
    selectedType: null,
    photos: [],
    file: null,
    text: '',
  })

  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const errorId = useRef(0)
  const tokenCheckStarted = useRef(false)
  const reduceMotion = useReducedMotion()

  const showError = useCallback((text: string) => {
    errorId.current += 1
    setError({ text, id: errorId.current })
    notify('error')
    if (errorTimer.current) clearTimeout(errorTimer.current)
    errorTimer.current = setTimeout(() => setError(null), 3000)
  }, [])

  const showNoAccess = useCallback((msg: string) => {
    setNoAccessMessage(msg)
    setScreen('noaccess')
  }, [])

  // ── Проверка токена при старте (до 3 попыток — Railway cold start ~30 сек) ──
  useEffect(() => {
    if (tokenCheckStarted.current) return
    tokenCheckStarted.current = true

    let cancelled = false

    async function run() {
      // DEV-демо: ?demo=1 → сразу показать экран результата с примером (без бэкенда).
      if (import.meta.env.DEV) {
        const demoType = getDemoType()
        if (demoType) {
          setResult({ text: DEMO_RESULTS[demoType], type: demoType })
          setScreen('result')
          return
        }
      }
      if (!URL_TOKEN) {
        // В dev-режиме без токена открываем форму, чтобы можно было тыкать UI
        // без Telegram и валидного токена. В проде ведёт себя как раньше.
        if (import.meta.env.DEV) {
          setScreen('form')
        } else {
          showNoAccess(NO_TOKEN_MSG)
        }
        return
      }
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const ok = await checkToken(URL_TOKEN, AbortSignal.timeout(20000))
          if (cancelled) return
          if (ok) {
            setScreen('form')
          } else {
            showNoAccess(USED_TOKEN_MSG)
          }
          return
        } catch {
          if (cancelled) return
          if (attempt < 2) {
            setCheckingMessage(`Сервер запускается (${attempt + 1}/2)`)
            await delay(15000)
            if (cancelled) return
          } else {
            showNoAccess(SERVER_DOWN_MSG)
          }
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [showNoAccess])

  useEffect(() => {
    return () => {
      if (errorTimer.current) clearTimeout(errorTimer.current)
    }
  }, [])

  // Прокрутка наверх при каждой смене экрана (как в оригинале).
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [screen])

  // ── Хендлеры формы ──
  const onSelectType = (selectedType: WorkType) =>
    setForm((f) => ({ ...f, selectedType }))
  const onPhotosChange = (photos: string[]) => setForm((f) => ({ ...f, photos }))
  const onFileChange = (file: AttachedFile | null) => setForm((f) => ({ ...f, file }))
  const onTextChange = (text: string) => setForm((f) => ({ ...f, text }))

  const onRecognized = (recognized: string) =>
    setForm((f) => ({
      ...f,
      text: f.text.trim() ? `${f.text.trim()}\n\n${recognized}` : recognized,
    }))

  async function onSubmit() {
    const text = form.text.trim()
    const { selectedType, photos, file } = form

    if (!selectedType) {
      showError('⚠️ Выберите тип работы')
      return
    }
    if (!text && !file && photos.length === 0) {
      showError('⚠️ Введите текст или прикрепите файл/фото')
      return
    }
    if (text && text.length < MIN_TEXT_LENGTH && !file && photos.length === 0) {
      showError('⚠️ Текст слишком короткий (минимум 50 символов)')
      return
    }

    setScreen('loading')
    try {
      const answer = await submitProxy({
        token: URL_TOKEN,
        type: selectedType,
        text,
        photos,
        file,
      })
      setResult({ text: answer, type: selectedType })
      setScreen('result')
      notify('success')
    } catch (e) {
      setScreen('form')
      let msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('invalid_token') || msg.includes('403')) {
        msg = 'Сессия истекла. Дождись новой кнопки от бота или нажми /start.'
      } else if (msg.includes('xAI error') || msg.includes('502')) {
        msg = 'ИИ временно недоступен. Попробуй через несколько минут.'
      } else if (msg.includes('429')) {
        msg = 'Слишком много запросов. Попробуй через минуту.'
      } else if (msg.includes('empty_work')) {
        msg = 'Введи текст или прикрепи файл.'
      } else if (
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('500') ||
        msg.includes('AbortError')
      ) {
        msg = 'Сервер не отвечает. Подожди 30–60 секунд и попробуй снова.'
      }
      showError('❌ ' + msg)
    }
  }

  function renderScreen() {
    switch (screen) {
      case 'checking':
        return <CheckingScreen message={checkingMessage} />
      case 'noaccess':
        return <NoAccessScreen message={noAccessMessage} />
      case 'loading':
        return <LoadingScreen />
      case 'result':
        return result ? (
          <ResultScreen text={result.text} type={result.type} />
        ) : (
          <LoadingScreen />
        )
      case 'form':
      default:
        return (
          <FormScreen
            token={URL_TOKEN}
            form={form}
            error={error}
            onSelectType={onSelectType}
            onPhotosChange={onPhotosChange}
            onFileChange={onFileChange}
            onTextChange={onTextChange}
            onRecognized={onRecognized}
            onError={showError}
            onSubmit={onSubmit}
          />
        )
    }
  }

  // Плавные переходы между экранами. mode="wait" — уходящий экран завершает
  // exit, затем входит новый. Уважает prefers-reduced-motion.
  const enter = reduceMotion
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 18, scale: 0.985 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -14, scale: 0.99 },
      }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={screen}
        initial={enter.initial}
        animate={enter.animate}
        exit={enter.exit}
        transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      >
        {renderScreen()}
      </motion.div>
    </AnimatePresence>
  )
}
