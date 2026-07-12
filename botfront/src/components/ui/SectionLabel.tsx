import type { ReactNode } from 'react'
import type { CSSProperties } from 'react'
import styles from './SectionLabel.module.css'

export function SectionLabel({
  children,
  hint,
  style,
}: {
  children: ReactNode
  hint?: string
  style?: CSSProperties
}) {
  return (
    <div className={styles.label} style={style}>
      {children}
      {hint ? <span className={styles.hint}> — {hint}</span> : null}
    </div>
  )
}
