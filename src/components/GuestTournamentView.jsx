import React from 'react'
import { useApp } from '../context/AppContext'
import { Calendar, MapPin, Users, Trophy, LogIn, ArrowLeft } from 'lucide-react'
import { DateTile, AddToCalendarButton, ShareWhatsAppButton } from './CalendarPieces'

// =============================================================================
//  GuestTournamentView — read-only event page for logged-out visitors.
//
//  Phase 2 of the auth gating refactor. Shows the public-safe slice of a
//  tournament: name, date, location, format, description, and the
//  registered / waitlist COUNTS (never names). Clicking "Register" routes
//  to the registration page, which is protected, so the VerificationGate
//  will prompt for a PIN.
//
//  Data sources:
//    - tournaments              — public_tournaments view (role === 'guest')
//    - publicCounts[t.id]       — public_tournament_registration_counts view
//    - NO access to players, registrations, matches, etc.
// =============================================================================

export default function GuestTournamentView({ onNavigate }) {
  const { tournaments, publicCounts = {} } = useApp()

  // Which event is the visitor looking at? Page-state routing doesn't carry
  // an ID the way URL routing would, so we fall back to "the next upcoming".
  // App.jsx's deep-link handler (?event=X) currently sends users to the
  // registration page; a future improvement is to land here instead and keep
  // the selection in context so a guest can browse a specific event. For now
  // this view lists all upcoming events, expanded.
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const parseLocalDate = (s) => {
    if (!s) return null
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
    if (m) return new Date(+m[1], +m[2] - 1, +m[3])
    const d = new Date(s)
    return isNaN(d) ? null : d
  }
  const upcoming = (tournaments || [])
    .filter((t) => {
      if (t.status === 'completed') return false
      const d = parseLocalDate(t.date)
      return d === null || d >= today
    })
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5">
      <button
        onClick={() => onNavigate?.('dashboard')}
        className="text-sm text-gray-600 hover:text-lobster-teal flex items-center gap-1"
      >
        <ArrowLeft size={14} /> Back
      </button>

      <h1 className="text-xl font-extrabold text-gray-800 flex items-center gap-2">
        <Trophy size={18} className="text-lobster-teal" />
        Upcoming tournaments
      </h1>

      {upcoming.length === 0 && (
        <div className="bg-white rounded-2xl p-6 text-center text-sm text-gray-500 border border-gray-100">
          No upcoming events yet. Check back soon 🦞
        </div>
      )}

      {upcoming.map((t) => {
        const counts = publicCounts[t.id] || {}
        const registered = counts.registered_count ?? 0
        const waitlist = counts.waitlist_count ?? 0
        const max = t.max_players ?? t.maxPlayers
        const isFull = max && registered >= max
        return (
          <article
            key={t.id}
            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3"
          >
            <header className="flex items-start gap-3">
              <DateTile date={t.date} />
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-gray-800">{t.name}</h2>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                  <MapPin size={11} /> {t.location || 'TBA'}
                </p>
                {t.format && (
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <Trophy size={11} /> {t.format}
                  </p>
                )}
              </div>
            </header>

            {t.description && (
              <p className="text-sm text-gray-700 whitespace-pre-line leading-snug">
                {t.description}
              </p>
            )}

            <div className="flex items-center justify-between pt-1">
              <div className="text-xs text-gray-600 flex items-center gap-1">
                <Users size={12} />
                <span className="font-semibold">
                  {registered}
                  {max ? ` / ${max}` : ''}
                </span>
                <span className="text-gray-400">registered</span>
                {waitlist > 0 && <span className="text-amber-600 ml-1">+{waitlist} waitlist</span>}
              </div>
              <div className="flex items-center gap-2">
                <AddToCalendarButton tournament={t} compact />
                <ShareWhatsAppButton tournament={t} compact />
              </div>
            </div>

            <button
              onClick={() => onNavigate?.('registration', t)}
              className="w-full bg-lobster-teal text-white font-bold text-sm py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-teal-700 transition disabled:opacity-60"
              disabled={isFull}
              aria-label={`Sign in to register for ${t.name}`}
            >
              <LogIn size={14} />
              {isFull ? 'Event full — sign in to join waitlist' : 'Sign in to register'}
            </button>
          </article>
        )
      })}

      <p className="text-[11px] text-gray-400 text-center pt-2">
        Player lists are visible to Lobsters only. Sign in to see who's playing.
      </p>
    </div>
  )
}
