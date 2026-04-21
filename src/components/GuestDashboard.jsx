import React from 'react'
import { useApp } from '../context/AppContext'
import { Calendar, Users, LogIn, Trophy, Building2, Clock, MapPin } from 'lucide-react'
import { DateTile, AddToCalendarButton, ShareWhatsAppButton } from './CalendarPieces'
import { fmtEur } from '../lib/format'

// =============================================================================
//  GuestDashboard — what logged-out visitors see on the landing ("homebase").
//
//  Shows ALL upcoming events styled the same way the Player view renders its
//  "Your Next Event" card, so the first thing a visitor sees matches what a
//  member sees once signed in.
//
//  Interaction model — everything the visitor can tap routes to a protected
//  page (registration / players / updates / merch / tournament). Because those
//  pages are NOT in PUBLIC_PAGES (src/lib/authPaths.js), <VerificationGate>
//  intercepts the navigation and surfaces the sign-in / sign-up popup instead
//  of rendering the real page. Sub-tile clicks in the bottom nav behave the
//  same way for the same reason.
//
//  No Updates, no player stats, no admin chrome — the landing stays focused
//  on "here's what's coming up, sign in to join."
// =============================================================================

export default function GuestDashboard({ onNavigate }) {
  const { tournaments, publicCounts = {}, loading } = useApp()

  // Upcoming = not completed, date today or later. Same predicate the full
  // Dashboard and Events tab use so the "what's coming up" framing is
  // consistent across the app.
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

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
    })
  }

  // Same per-person cost rule the Dashboard uses for "Your Next Event".
  const perPersonCost = (t) => {
    const tp = parseFloat(t.totalPrice ?? t.total_price) || 0
    const mp = parseInt(t.maxPlayers ?? t.max_players) || 16
    if (!t.courtBookingMode || t.courtBookingMode === 'admin_all') {
      return tp > 0 ? tp / mp : 0
    }
    return (t.courts || []).reduce((s, c) => s + (parseFloat(c.costPerPerson) || 0), 0)
  }

  // Every interactive element on this page routes to a protected page so the
  // VerificationGate wraps the navigation with the sign-in popup. `registration`
  // is the natural landing for a tile click because the user's intent is to
  // join the event — once they sign in, they stay on that event's reg page.
  const gate = (tournament = null) => onNavigate?.('registration', tournament)

  return (
    <div className="space-y-5">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-lobster-teal via-teal-700 to-teal-900 rounded-3xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🦞</span>
          <h1 className="text-2xl font-extrabold">Welcome to Padel Lobsters</h1>
        </div>
        <p className="text-sm text-white/90 leading-snug">
          A padel community in Amsterdam. Browse what's coming up below —
          sign in with your PIN to register, update scores, or see player
          profiles.
        </p>
        <button
          onClick={() => gate()}
          className="mt-4 bg-white text-lobster-teal font-bold text-sm px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-lobster-cream transition active:scale-95"
        >
          <LogIn size={14} /> Sign in / Sign up
        </button>
      </div>

      {/* ── Upcoming events section ───────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
            <Calendar size={18} className="text-lobster-teal" />
            Upcoming events{!loading ? ` (${upcoming.length})` : ''}
          </h2>
        </div>

        {loading && (
          <div className="text-sm text-gray-400 italic">Loading events…</div>
        )}

        {!loading && upcoming.length === 0 && (
          <div className="card flex flex-col items-center py-8 text-center gap-2">
            <Calendar size={36} className="text-gray-300" />
            <p className="text-sm text-gray-500">No upcoming events right now</p>
            <p className="text-xs text-gray-400">
              Check back soon — next tournament is around the corner 🦞
            </p>
          </div>
        )}

        <div className="space-y-3">
          {upcoming.map(t => {
            const counts     = publicCounts[t.id] || {}
            const registered = counts.registered_count ?? 0
            const waitlist   = counts.waitlist_count ?? 0
            const max        = t.max_players ?? t.maxPlayers
            const isFull     = max && registered >= max
            const ppCost     = perPersonCost(t)

            return (
              // Mirrors the Dashboard "Your Next Event" glass card — same
              // backdrop, same DateTile + title + date/time/cost layout, same
              // action row. Keeps visual grammar consistent between the guest
              // landing and the logged-in Home page.
              <div
                key={t.id}
                className="rounded-2xl p-4 shadow-sm bg-white/80 border border-white/90"
                style={{ backdropFilter: 'blur(12px)' }}
              >
                <p className="text-[10px] font-bold text-lobster-orange uppercase tracking-wide mb-1">
                  Upcoming Event
                </p>

                <h3 className="text-lg font-bold text-gray-800">
                  <button
                    onClick={() => gate(t)}
                    className="hover:text-lobster-teal active:scale-95 transition-all text-left"
                  >
                    {t.name}
                  </button>
                </h3>

                <div className="mt-2 mb-3 flex items-center gap-3">
                  <DateTile date={t.date} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold text-gray-800 leading-tight">
                      {formatDate(t.date)}
                    </p>
                    {t.time && (
                      <p className="text-sm text-gray-500 leading-tight mt-0.5">
                        {t.time}
                        {t.duration ? ` · ${t.duration}min` : ''}
                      </p>
                    )}
                    {ppCost > 0 && (
                      <p className="text-sm font-semibold text-lobster-teal leading-tight mt-0.5">
                        {fmtEur(ppCost)}/pp
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <ShareWhatsAppButton tournament={t} variant="icon" />
                    <AddToCalendarButton tournament={t} variant="icon" />
                  </div>
                </div>

                {/* Location + spots row — count-only (no player names) */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600 mb-3">
                  {t.location && (
                    <span className="flex items-center gap-1 text-lobster-teal">
                      <Building2 size={11} /> {t.location}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Users size={11} />
                    {registered}{max ? ` / ${max}` : ''} registered
                  </span>
                  {waitlist > 0 && (
                    <span className="text-amber-600">+{waitlist} waitlist</span>
                  )}
                  {t.format && (
                    <span className="flex items-center gap-1 text-gray-400">
                      <Trophy size={11} /> {t.format}
                    </span>
                  )}
                </div>

                {/* Status banner — mirrors the Events tab */}
                {isFull ? (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 mb-3">
                    <p className="text-xs font-bold text-orange-700">Sold out!</p>
                    <p className="text-[11px] text-orange-600 mt-0.5">
                      Sign in to join the waitlist — someone always cancels.
                    </p>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-1.5 mb-3 flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2 flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <p className="text-xs font-semibold text-green-700">
                      Spots open — sign in to sign up!
                    </p>
                  </div>
                )}

                {/* Event description — the public_tournaments view exposes a
                    `description` column, while the raw tournaments table uses
                    `notes`. Fall back from one to the other so the landing
                    shows the same blurb the player Dashboard does. */}
                {(() => {
                  const blurb = (t.description || t.notes || '').trim()
                  if (!blurb) return null
                  return (
                    <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line mb-3">
                      {blurb}
                    </p>
                  )
                })()}

                {/* Single CTA — routes to a protected page, so the gate shows
                    the sign-in / sign-up popup. */}
                <button
                  onClick={() => gate(t)}
                  className="w-full bg-lobster-orange text-white font-semibold py-2 rounded-xl text-xs active:scale-95 transition-all flex items-center justify-center gap-2"
                  aria-label={`Sign in to register for ${t.name}`}
                >
                  <LogIn size={12} />
                  {isFull ? 'Sign in to join waitlist' : 'Sign in to register'}
                </button>
              </div>
            )
          })}
        </div>
      </section>

      <p className="text-[11px] text-gray-400 text-center pt-2">
        Player lists, scores and stats are for Lobsters only. Sign in to see
        who's playing.
      </p>
    </div>
  )
}
