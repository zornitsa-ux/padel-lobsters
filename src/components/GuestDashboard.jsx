import React from 'react'
import { useApp } from '../context/AppContext'
import { Calendar, MapPin, Users, LogIn, Trophy } from 'lucide-react'
import { DateTile } from './CalendarPieces'

// =============================================================================
//  GuestDashboard — what logged-out visitors see on the landing page.
//
//  Phase 2 of the auth gating refactor. The full Dashboard reads from private
//  state (registrations, matches, players, aliases) that guests can't access;
//  this is a deliberately-minimal landing that reads ONLY from:
//
//    - tournaments         — loaded from the `public_tournaments` view when
//                            role === 'guest' (see AppContext Phase 2 edits)
//    - publicCounts        — loaded from the `public_tournament_registration_counts`
//                            view; count-only, never player_ids
//
//  Everything else is replaced by a "Sign in to see more" prompt that routes
//  the visitor to the PIN page. No player names, no stats, no history.
// =============================================================================

export default function GuestDashboard({ onNavigate }) {
  const { tournaments, publicCounts = {}, loading } = useApp()

  // Upcoming = not completed, date today or later. Same predicate the full
  // Dashboard uses so the "what's coming up" framing stays consistent.
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const parseLocalDate = (s) => {
    if (!s) return null
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
    if (m) return new Date(+m[1], +m[2] - 1, +m[3])
    const d = new Date(s)
    return isNaN(d) ? null : d
  }
  const upcoming = (tournaments || [])
    .filter(t => {
      if (t.status === 'completed') return false
      const d = parseLocalDate(t.date)
      return d === null || d >= today
    })
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5">
      {/* Hero */}
      <div className="bg-gradient-to-br from-lobster-teal via-teal-700 to-teal-900 rounded-3xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🦞</span>
          <h1 className="text-2xl font-extrabold">Padel Lobsters</h1>
        </div>
        <p className="text-sm text-white/90 leading-snug">
          A padel community in Amsterdam. Browse upcoming tournaments
          below — sign in with your PIN to register, update scores,
          or see player profiles.
        </p>
        <button
          onClick={() => onNavigate?.('registration')}
          className="mt-4 bg-white text-lobster-teal font-bold text-sm px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-lobster-cream transition"
        >
          <LogIn size={14} /> Sign in with your PIN
        </button>
      </div>

      {/* Upcoming events list */}
      <section>
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-3">
          <Calendar size={18} className="text-lobster-teal" />
          Upcoming events ({upcoming.length})
        </h2>

        {loading && (
          <div className="text-sm text-gray-400 italic">Loading events…</div>
        )}

        {!loading && upcoming.length === 0 && (
          <div className="bg-white rounded-2xl p-6 text-center text-sm text-gray-500 border border-gray-100">
            No upcoming events yet. Check back soon 🦞
          </div>
        )}

        <div className="space-y-3">
          {upcoming.map(t => {
            const counts = publicCounts[t.id] || {}
            const registered = counts.registered_count ?? 0
            const waitlist   = counts.waitlist_count ?? 0
            const max = t.max_players ?? t.maxPlayers
            return (
              <div
                key={t.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3"
              >
                <DateTile date={t.date} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-800 truncate">{t.name}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <MapPin size={11} />
                    <span className="truncate">{t.location || 'TBA'}</span>
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                    <span className="flex items-center gap-1">
                      <Users size={11} />
                      {registered}{max ? ` / ${max}` : ''} registered
                    </span>
                    {waitlist > 0 && (
                      <span className="text-amber-600">+{waitlist} waitlist</span>
                    )}
                    {t.format && (
                      <span className="flex items-center gap-1 text-gray-400">
                        <Trophy size={11} />
                        {t.format}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onNavigate?.('registration', t)}
                  className="text-xs font-semibold bg-lobster-cream text-lobster-teal px-3 py-1.5 rounded-lg hover:bg-teal-50 transition flex-shrink-0"
                  aria-label={`Sign in to register for ${t.name}`}
                >
                  Sign in to register
                </button>
              </div>
            )
          })}
        </div>
      </section>

    </div>
  )
}
