import { ChevronLeft, ChevronRight } from 'lucide-react'

import { addDays, daysBetween, formatDay } from '../../lib/format'
import { Button } from './Button'
import styles from './DayStepper.module.css'

interface DayStepperProps {
  value: string
  first: string
  last: string
  onChange: (day: string) => void
}

export function DayStepper({ value, first, last, onChange }: DayStepperProps) {
  return (
    <div className={styles.stepper}>
      <Button
        iconOnly
        icon={<ChevronLeft size={17} />}
        aria-label="Previous day"
        disabled={value <= first}
        onClick={() => onChange(addDays(value, -1))}
      />
      <select
        className={styles.select}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Delivery day"
      >
        {daysBetween(first, last).map((d) => (
          <option key={d} value={d}>
            {formatDay(d)} {d.slice(0, 4)}
          </option>
        ))}
      </select>
      <Button
        iconOnly
        icon={<ChevronRight size={17} />}
        aria-label="Next day"
        disabled={value >= last}
        onClick={() => onChange(addDays(value, 1))}
      />
    </div>
  )
}
