import type { CSSProperties } from 'react'

import styles from './Slider.module.css'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  format?: (value: number) => string
  /** Tick labels under the track. */
  marks?: number[]
}

export function Slider({ label, value, min, max, step = 1, onChange, format = String, marks }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className={styles.slider} style={{ '--pct': `${pct}%` } as CSSProperties}>
      <div className={styles.top}>
        <label className={styles.label}>
          {label}
          <input
            type="range"
            className={styles.input}
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-valuetext={format(value)}
          />
        </label>
        <output className={styles.value}>{format(value)}</output>
      </div>
      {marks && (
        <div className={styles.marks} aria-hidden>
          {marks.map((m) => (
            <span key={m} style={{ left: `${((m - min) / (max - min)) * 100}%` }}>
              {format(m)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
