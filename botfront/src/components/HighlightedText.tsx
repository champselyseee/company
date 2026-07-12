import type { ResultSegment } from '../lib/types'
import styles from './HighlightedText.module.css'

/** Текст работы с подсветкой ошибок: каждый сегмент с e!="none" подчёркивается
 *  цветом своего типа. Сумма сегментов = исходный текст работы. */
export function HighlightedText({ segments }: { segments: ResultSegment[] }) {
  return (
    <div className={styles.text}>
      {segments.map((s, i) =>
        s.e && s.e !== 'none' ? (
          <mark key={i} className={`${styles.mark} ${styles[s.e]}`}>
            {s.t}
          </mark>
        ) : (
          <span key={i}>{s.t}</span>
        ),
      )}
    </div>
  )
}
