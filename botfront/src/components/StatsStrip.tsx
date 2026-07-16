import { useEffect, useState } from 'react'
import { fetchStats } from '../lib/api'
import { useCountUp } from '../lib/useCountUp'
import styles from './StatsStrip.module.css'

/* Витринное число на случай, если бэкенд ещё не отдаёт счётчик (как на сайте):
   как только придёт живое значение из БД — оно заменит эту заглушку. */
const FALLBACK_TOTAL = 12480

/* Полоса счётчиков на форме: общий счётчик проверок (всегда) + личный счётчик
   пользователя (если бэкенд его вернул). Числа плавно «докручиваются» от нуля. */
export function StatsStrip() {
  const [total, setTotal] = useState<number | null>(null)
  const [mine, setMine] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    const ctrl = new AbortController()
    fetchStats(ctrl.signal).then((s) => {
      if (!alive) return
      setTotal(s.total)
      setMine(s.mine)
    })
    return () => {
      alive = false
      ctrl.abort()
    }
  }, [])

  const totalCount = useCountUp(total ?? FALLBACK_TOTAL)
  const mineCount = useCountUp(mine ?? 0)
  const hasMine = mine !== null

  return (
    <div className={`${styles.strip} ${hasMine ? '' : styles.single}`}>
      <div className={styles.tile}>
        <span className={styles.num}>{totalCount.toLocaleString('ru-RU')}</span>
        <span className={styles.label}>работ проверено</span>
      </div>
      {hasMine && (
        <div className={`${styles.tile} ${styles.tileMine}`}>
          <span className={styles.num}>{mineCount.toLocaleString('ru-RU')}</span>
          <span className={styles.label}>твоих проверок</span>
        </div>
      )}
    </div>
  )
}
