import styles from './LoadingDots.module.css'

/** Анимированное «...» после текста загрузки. */
export function LoadingDots() {
  return <span className={styles.dots} aria-hidden="true" />
}
