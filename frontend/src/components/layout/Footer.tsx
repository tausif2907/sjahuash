import styles from './Footer.module.css'

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <p>
          Data: Elexon BMRS, <code>FUELHH</code> (outturn) and <code>WINDFOR</code> (forecasts). Times in UK
          local time. Error = actual − forecast.
        </p>
        <nav className={styles.links} aria-label="Resources">
          <a href="/api/docs" target="_blank" rel="noreferrer">
            API docs
          </a>
          <a href="https://bmrs.elexon.co.uk/api-documentation" target="_blank" rel="noreferrer">
            Elexon API
          </a>
        </nav>
      </div>
    </footer>
  )
}
