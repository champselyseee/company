import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
  /** Верхний отступ как в оригинале (primary → 14px, secondary → 12px). */
  spaced?: boolean
  /** Иконка перед подписью — как у кнопок сайта. */
  leading?: ReactNode
  /** Иконка после подписи — как у кнопок сайта. */
  trailing?: ReactNode
}

export function Button({
  variant = 'primary',
  spaced = false,
  leading,
  trailing,
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
      {leading}
      {children}
      {trailing}
    </button>
  )
}
