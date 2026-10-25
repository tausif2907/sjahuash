import type { ReactNode } from 'react'

import styles from './Card.module.css'

interface CardProps {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  footer?: ReactNode
  children: ReactNode
  /** Hold the previous render, dimmed, while new data loads. */
  busy?: boolean
  className?: string
}

export function Card({ title, subtitle, actions, footer, children, busy, className }: CardProps) {
  return (
    <section className={`${styles.card} ${className ?? ''}`} aria-busy={busy || undefined}>
      {(title || actions) && (
        <header className={styles.header}>
          <div className={styles.heading}>
            {title && <h2 className={styles.title}>{title}</h2>}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
      )}
      <div className={styles.body} data-busy={busy || undefined}>
        {children}
      </div>
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </section>
  )
}
