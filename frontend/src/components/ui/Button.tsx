import type { ButtonHTMLAttributes, ReactNode } from 'react'

import styles from './Button.module.css'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'primary'
  size?: 'sm' | 'md'
  icon?: ReactNode
  /** Icon-only button: children are omitted and `aria-label` is required. */
  iconOnly?: boolean
}

export function Button({
  variant = 'default',
  size = 'md',
  icon,
  iconOnly,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${styles.button} ${className ?? ''}`}
      data-variant={variant}
      data-size={size}
      data-icon-only={iconOnly || undefined}
      {...rest}
    >
      {icon}
      {!iconOnly && children}
    </button>
  )
}
