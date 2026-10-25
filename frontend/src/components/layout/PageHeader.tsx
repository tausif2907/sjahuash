import type { ReactNode } from 'react'

import styles from './PageHeader.module.css'

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children?: ReactNode
}) {
  return (
    <div className={styles.header}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1 className={styles.title}>{title}</h1>
      {children && <p className={styles.lede}>{children}</p>}
    </div>
  )
}

/** One filter row above the content it scopes. */
export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className={styles.toolbar} role="toolbar">
      {children}
    </div>
  )
}

export function ToolbarGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.group}>
      <span className={styles.groupLabel}>{label}</span>
      {children}
    </div>
  )
}
