/** Unit caption above the y-axis, kept out of the plot so it never collides with ticks. */
export function AxisUnit({ children }: { children: string }) {
  return (
    <div
      style={{
        margin: '0 0 2px 4px',
        fontSize: 11.5,
        fontWeight: 500,
        color: 'var(--ink-muted)',
      }}
      aria-hidden
    >
      {children}
    </div>
  )
}
