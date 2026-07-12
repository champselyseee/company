import type { ReactNode } from 'react'
import styles from './Card.module.css'

type Variant = 'form' | 'loading' | 'result' | 'noaccess'

export function Card({ variant, children }: { variant: Variant; children: ReactNode }) {
  return <div className={`${styles.card} ${styles[variant]}`}>{children}</div>
}
