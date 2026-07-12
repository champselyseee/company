import type { ButtonHTMLAttributes } from 'react'
import styles from './Button.module.css'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
  /** Верхний отступ как в оригинале (primary → 14px, secondary → 12px). */
  spaced?: boolean
}

export function Button({
  variant = 'primary',
  spaced = false,
  className,
  children,
  ...rest
}: Props) {
  const spacing = spaced ? (variant === 'primary' ? styles.spaced : styles.spacedSm) : ''
  return (
    <button
      className={[styles.base, styles[variant], spacing, className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
}
