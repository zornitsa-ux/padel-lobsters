import React from 'react'

/* ─── Content shell with title and an optional header-right slot ── */
export function Shell({ title, headerRight, children }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-gray-100">
        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
        {headerRight}
      </div>
      {children}
    </div>
  )
}

export function SectionLabel({ children }) {
  return (
    <p className="text-[11px] uppercase tracking-wider font-bold text-gray-400 mt-2 mb-2 px-1">
      {children}
    </p>
  )
}

export function PhaseBanner({ status, startedAt, closedAt, sharedAt }) {
  const stamp = (iso) =>
    iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
  if (status === 'active') {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-lob-coral animate-pulse" />
        <span className="text-sm font-semibold text-gray-700">Active</span>
        <span className="text-xs text-gray-400 ml-auto">started {stamp(startedAt)}</span>
      </div>
    )
  }
  if (status === 'ended') {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-2xl px-4 py-3">
        <p className="text-sm font-semibold text-yellow-800">Voting closed at {stamp(closedAt)}</p>
        <p className="text-xs text-yellow-700/80 mt-0.5">
          Players see a "waiting for results" screen. Press <em>Share with players</em> below to
          reveal.
        </p>
      </div>
    )
  }
  if (status === 'shared') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
        <p className="text-sm font-semibold text-green-800">
          Shared with players at {stamp(sharedAt)}
        </p>
        <p className="text-xs text-green-700/80 mt-0.5">Everyone can now see the results.</p>
      </div>
    )
  }
  return null
}
