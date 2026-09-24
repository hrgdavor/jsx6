/** Tiny stats helper: the benchmark runner reports medians, never a single run. */

export const median = values => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export const mean = values => values.reduce((a, b) => a + b, 0) / values.length

export const fmtMs = ms =>
  ms === null || ms === undefined ? 'n/a' : `${ms < 10 ? ms.toFixed(2) : ms.toFixed(1)} ms`

export const fmtKb = kb => (kb === null || kb === undefined ? 'n/a' : `${kb} kB`)

export const pctVs = (value, base) => {
  if (value === null || value === undefined || !base) return ''
  const pct = ((value - base) / base) * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`
}
