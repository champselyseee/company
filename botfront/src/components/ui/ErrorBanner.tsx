import styles from './ErrorBanner.module.css'

/** Красная плашка ошибки с shake-анимацией. Рендерить с key, чтобы анимация повторялась. */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className={styles.banner} role="alert">
      {message}
    </div>
  )
}
