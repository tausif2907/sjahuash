import { signColor } from './chartTheme'

interface ShapeProps {
  x?: number
  y?: number
  width?: number
  height?: number
  payload?: Record<string, unknown>
}

const R = 4

/**
 * Bar whose data end is rounded and whose base stays square on the baseline.
 * `valueKey` decides which end is the data end (its sign); `colorKey` decides the
 * colour (shortfall below zero, surplus above) and defaults to the same field.
 */
export function signedBarShape(valueKey: string, colorKey: string = valueKey) {
  return function SignedBarShape({ x = 0, y = 0, width = 0, height = 0, payload }: ShapeProps) {
    const value = Number(payload?.[valueKey] ?? 0)
    const top = Math.min(y, y + height)
    const h = Math.abs(height)
    if (!h || !width) return <g />
    const r = Math.min(R, width / 2, h)
    const positive = value >= 0
    const d = positive
      ? `M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + width - r} Q${x + width},${top} ${x + width},${top + r} V${top + h} Z`
      : `M${x},${top} H${x + width} V${top + h - r} Q${x + width},${top + h} ${x + width - r},${top + h} H${x + r} Q${x},${top + h} ${x},${top + h - r} Z`
    return <path d={d} fill={signColor(Number(payload?.[colorKey] ?? 0))} className="signed-bar" />
  }
}
