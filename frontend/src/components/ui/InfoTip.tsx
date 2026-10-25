import { Info } from 'lucide-react'
import { useId } from 'react'

import styles from './InfoTip.module.css'

/** Small "i" that reveals a definition on hover or keyboard focus. */
export function InfoTip({ text, label = 'More information' }: { text: string; label?: string }) {
  const id = useId()
  return (
    <span className={styles.wrap}>
      <button type="button" className={styles.trigger} aria-label={label} aria-describedby={id}>
        <Info size={14} aria-hidden />
      </button>
      <span role="tooltip" id={id} className={styles.bubble}>
        {text}
      </span>
    </span>
  )
}
