import React from 'react'
import { letterColor } from '../../lib/letterColors'

// ── Player avatar component ───────────────────────────────────────────────────
export default function Avatar({ player, size = 'md', className = '' }) {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-lg' }
  const cls = sizes[size] || sizes.md
  if (player.avatarUrl) {
    return (
      <img
        src={player.avatarUrl}
        alt={player.name}
        className={`${cls} rounded-full object-cover flex-shrink-0 ${className}`}
        onError={(e) => {
          e.target.style.display = 'none'
          e.target.nextSibling?.style && (e.target.nextSibling.style.display = 'flex')
        }}
      />
    )
  }
  return (
    <div
      className={`${cls} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${className}`}
      style={{ backgroundColor: letterColor(player.name) }}
    >
      {(player.name || '?')[0].toUpperCase()}
    </div>
  )
}
