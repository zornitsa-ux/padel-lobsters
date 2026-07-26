import type { CSSProperties } from 'react'

export function medalColor(pos: number): string {
  if (pos === 0) return 'text-yellow-500'
  if (pos === 1) return 'text-gray-400'
  if (pos === 2) return '' // bronze via inline style
  return 'text-gray-400'
}
export function medalStyleH(pos: number): CSSProperties {
  return pos === 2 ? { color: '#CD7F32' } : {}
}
