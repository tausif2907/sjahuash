import { describe, expect, it } from 'vitest'

import { niceTicks } from './chartTheme'

describe('niceTicks', () => {
  it('covers the range with round steps', () => {
    expect(niceTicks(0, 12_345)).toEqual([0, 2500, 5000, 7500, 10_000, 12_500])
  })

  it('handles ranges that cross zero', () => {
    expect(niceTicks(-4250, 406)).toEqual([-5000, -4000, -3000, -2000, -1000, 0, 1000])
  })

  it('handles small and degenerate ranges', () => {
    expect(niceTicks(0, 23, 4)).toEqual([0, 10, 20, 30])
    expect(niceTicks(0, 0)).toEqual([0, 0.2])
  })
})
