import { AlertTriangle, RotateCw } from 'lucide-react'

import { Button } from './Button'
import styles from './States.module.css'

/** First-load placeholder only; refetches keep the previous render instead. */
export function Skeleton({ height = 280 }: { height?: number }) {
  return <div className={styles.skeleton} style={{ height }} aria-hidden />
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className={styles.error} role="alert">
      <AlertTriangle size={20} aria-hidden />
      <div>
        <p className={styles.errorTitle}>Couldn’t load this data</p>
        <p className={styles.errorMessage}>{message}</p>
      </div>
      {onRetry && (
        <Button size="sm" icon={<RotateCw size={14} />} onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ children }: { children: string }) {
  return <p className={styles.empty}>{children}</p>
}
