import React from 'react'

interface GreetingProps {
  hello: string
  sub: string
  loading?: boolean
}

// ── Greeting ──────────────────────────────────────────── */
// `loading` covers the first-ever visit, where the player's name hasn't
// arrived yet and there's no cached name to fall back on. Placeholder bars
// match the text metrics below so the greeting doesn't shift when it lands.
export default function Greeting({ hello, sub, loading = false }: GreetingProps) {
  if (loading) {
    return (
      <div aria-hidden="true">
        <div className="h-7 w-48 rounded bg-gray-200 animate-pulse" />
        <div className="mt-1.5 h-5 w-64 rounded bg-gray-100 animate-pulse" />
      </div>
    )
  }

  return (
    <div>
      <p className="text-xl font-extrabold text-lob-dark leading-snug">{hello}</p>
      <p className="text-base text-lob-muted mt-0.5">{sub}</p>
    </div>
  )
}
