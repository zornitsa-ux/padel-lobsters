import React from 'react'

// ── Greeting ──────────────────────────────────────────── */
export default function Greeting({ hello, sub }) {
  return (
    <div>
      <p className="text-xl font-extrabold text-gray-800 leading-snug">{hello}</p>
      <p className="text-base text-gray-500 mt-0.5">{sub}</p>
    </div>
  )
}
