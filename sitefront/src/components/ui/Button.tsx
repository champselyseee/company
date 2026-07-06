import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'md' | 'lg'
  fullWidth?: boolean
  leading?: ReactNode
  trailing?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  leading,
  trailing,
  className,
  children,
  ...rest
}: Props) {
  const cls = [
    styles.base,
    styles[variant],
    styles[size],
    fullWidth ? styles.full : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <button className={cls} {...rest}>
      {leading ? <span className={styles.ic}>{leading}</span> : null}
      <span>{children}</span>
      {trailing ? <span className={styles.ic}>{trailing}</span> : null}
    </button>
  )
}
