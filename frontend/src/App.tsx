import { useEffect, useState } from 'react'

type Health = { status: string; snapshot_generated_at: string | null }

// Placeholder shell: confirms the frontend can reach the API. The decision and
// accuracy views replace this once the analysis endpoints exist.
function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<Health>
      })
      .then(setHealth)
      .catch((err: Error) => setError(err.message))
  }, [])

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 16px' }}>
      <h1>Wind Forecast Monitor</h1>
      <p style={{ color: 'var(--text-muted)' }}>
        UK national wind generation: day-ahead forecasts against actual outturn.
      </p>
      {error && <p style={{ color: 'var(--error)' }}>API unreachable: {error}</p>}
      {health && (
        <p style={{ color: 'var(--ok)' }}>
          API {health.status}. Data snapshot from {health.snapshot_generated_at ?? 'not yet generated'}.
        </p>
      )}
    </main>
  )
}

export default App
