import { BookOpen, CalendarClock, Check, Database, Gauge, Link2, Moon, Sun } from 'lucide-react'
import { useState } from 'react'

import type { Meta } from '../../api/client'
import type { View } from '../../appState'
import { formatDayCompact } from '../../lib/format'
import type { Theme } from '../../lib/theme'
import { Button } from '../ui/Button'
import { BrandMark } from './BrandMark'
import styles from './Header.module.css'

const TABS: { view: View; label: string; icon: typeof Gauge }[] = [
  { view: 'day', label: 'Day-ahead view', icon: CalendarClock },
  { view: 'accuracy', label: 'Forecast accuracy', icon: Gauge },
  { view: 'method', label: 'Methodology', icon: BookOpen },
]

interface HeaderProps {
  view: View
  onNavigate: (view: View) => void
  meta?: Meta
  theme: Theme
  onToggleTheme: () => void
}

export function Header({ view, onNavigate, meta, theme, onToggleTheme }: HeaderProps) {
  const [copied, setCopied] = useState(false)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard can be blocked (insecure context, permissions); the URL bar still has the link.
    }
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <a className={styles.brand} href="./" aria-label="Wind Forecast Monitor home">
          <BrandMark />
          <span className={styles.brandText}>
            <span className={styles.name}>Wind Forecast Monitor</span>
            <span className={styles.tagline}>GB day-ahead · Pilot</span>
          </span>
        </a>

        <nav className={styles.nav} aria-label="Views">
          {TABS.map(({ view: v, label, icon: Icon }) => (
            <button
              key={v}
              type="button"
              className={styles.tab}
              aria-current={view === v ? 'page' : undefined}
              onClick={() => onNavigate(v)}
            >
              <Icon size={16} aria-hidden />
              {label}
            </button>
          ))}
        </nav>

        <div className={styles.tools}>
          {meta && (
            <span className={styles.coverage} title={`Elexon snapshot generated ${meta.generated_at}`}>
              <Database size={14} aria-hidden />
              {formatDayCompact(meta.first_day)} – {formatDayCompact(meta.last_day)} 2026
            </span>
          )}
          <Button
            variant="ghost"
            iconOnly
            icon={copied ? <Check size={17} /> : <Link2 size={17} />}
            aria-label={copied ? 'Link copied' : 'Copy link to this view'}
            title={copied ? 'Link copied' : 'Copy link to this view'}
            onClick={copyLink}
          />
          <Button
            variant="ghost"
            iconOnly
            icon={theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
            onClick={onToggleTheme}
          />
        </div>
      </div>
    </header>
  )
}
