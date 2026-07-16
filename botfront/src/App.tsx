import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { AttachedFile, Screen, WorkType } from './lib/types'
import { MIN_TEXT_LENGTH } from './lib/config'
import { submitProxy } from './lib/api'
import { notify, tg } from './lib/telegram'
import { DEMO_RESULTS, getDemoType } from './lib/demo'
import { CheckingScreen } from './components/screens/CheckingScreen'
import { NoAccessScreen } from './components/screens/NoAccessScreen'
import { LoadingScreen } from './components/screens/LoadingScreen'
import { FormScreen, type FormState } from './components/screens/FormScreen'
import { ResultScreen } from './components/screens/ResultScreen'

const NOT_IN_TG_MSG =
  'Открой приложение через кнопку в боте.\nНажми /start и выбери «✍️ Открыть проверку».'

export function App() {
  const [screen, setScreen] = useState<Screen>('checking')
  const [noAccessMessage, setNoAccessMessage] = useState(NOT_IN_TG_MSG)
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
  const startedRef = useRef(false)
  const submitting = useRef(false)
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

  // ── Старт: мини-аппа впускает в UI свободно (без токенов) ──
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    // DEV-демо: ?demo=1 → сразу экран результата с примером (без бэкенда).
    if (import.meta.env.DEV) {
      const demoType = getDemoType()
      if (demoType) {
        setResult({ text: DEMO_RESULTS[demoType], type: demoType })
        setScreen('result')
        return
      }
    }

    // Есть initData (приложение открыто внутри Telegram) → сразу форма.
    // Вход свободный: проверку и списание бэкенд делает уже при «Отправить».
    if (tg.initData || import.meta.env.DEV) {
      setScreen('form')
    } else {
      showNoAccess(NOT_IN_TG_MSG)
    }
  }, [showNoAccess])

  useEffect(() => {
    return () => {
      if (errorTimer.current) clearTimeout(errorTimer.current)
    }
  }, [])

  // Прокрутка наверх при каждой смене экрана.
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

    // Защита от двойного нажатия: одна проверка = одно списание.
    if (submitting.current) return
    submitting.current = true

    setScreen('loading')
    try {
      const answer = await submitProxy({ type: selectedType, text, photos, file })
      setResult({ text: answer, type: selectedType })
      setScreen('result')
      notify('success')
    } catch (e) {
      setScreen('form')
      let msg = e instanceof Error ? e.message : String(e)
      if (msg === 'no_checks') {
        msg = 'Проверки закончились. Пополни баланс в боте (/buy).'
      } else if (msg === 'unauthorized') {
        msg = 'Сессия не подтверждена. Открой приложение через кнопку в боте.'
      } else if (msg === 'empty_work') {
        msg = 'Введи текст или прикрепи фото/файл.'
      } else if (msg === 'unknown_type') {
        msg = 'Выбери тип работы.'
      } else if (msg === 'bad_json' || msg === 'server_error') {
        msg = 'Ошибка сервера. Попробуй ещё раз.'
      } else if (
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('AbortError') ||
        msg.includes('HTTP 5')
      ) {
        msg = 'Сервер не отвечает. Подожди 30–60 секунд и попробуй снова.'
      }
      showError('❌ ' + msg)
    } finally {
      submitting.current = false
    }
  }

  function renderScreen() {
    switch (screen) {
      case 'checking':
        return <CheckingScreen message="Загружаем" />
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
