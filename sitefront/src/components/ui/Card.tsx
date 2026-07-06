import type { CSSProperties, ReactNode } from 'react'
import styles from './Card.module.css'

interface Props {
  children: ReactNode
  /** Внутренний отступ. */
  pad?: 'sm' | 'md' | 'lg'
  /** Цвет смещённой тени. */
  shadow?: 'ink' | 'indigo' | 'coral'
  /** Лёгкий наклон «печатного стикера». */
  tilt?: number
  className?: string
  style?: CSSProperties
}

export function Card({ children, pad = 'md', shadow = 'ink', tilt, className, style }: Props) {
  const cls = [styles.card, styles[`pad_${pad}`], styles[`sh_${shadow}`], className]
    .filter(Boolean)
    .join(' ')
  const merged: CSSProperties = tilt ? { ...style, '--tilt': `${tilt}deg` } as CSSProperties : (style ?? {})
  return (
    <div className={`${cls} ${tilt ? styles.tilted : ''}`} style={merged}>
      {children}
    </div>
  )
}
