import React from 'react'
import { CalendarPlus, Share2 } from 'lucide-react'
import { downloadTournamentIcs } from '../lib/calendar'

// ============================================================================
//  DateTile
//
//  A classic calendar tear-off visual: tiny month banner on top, big day
//  number in the middle, day-of-week in small caps below. Used as the visual
//  anchor of every tournament tile and the event detail page — so players can
//  see at a glance which event is on which day.
// ============================================================================

export function DateTile({ date, size = 'md', className = '' }) {
  if (!date) return null
  const d = new Date(date)
  if (isNaN(d.getTime())) return null
  const month = d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()
  const day   = d.getDate()
  const dow   = d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase()

  const dims =
    size === 'lg'
      ? { box: 'w-16 h-20',       day: 'text-3xl', month: 'text-[10px] py-0.5', dow: 'text-[10px]' }
      : size === 'sm'
      ? { box: 'w-11 h-12',       day: 'text-lg',  month: 'text-[8px]  py-[1px]', dow: 'text-[8px]' }
      : { box: 'w-14 h-16',       day: 'text-2xl', month: 'text-[9px]  py-0.5', dow: 'text-[9px]' } // md

  return (
    <div
      className={`${dims.box} bg-white rounded-xl border border-lobster-teal/40 flex flex-col items-stretch flex-shrink-0 overflow-hidden shadow-sm ${className}`}
    >
      <div className={`${dims.month} font-bold bg-lobster-teal text-white text-center uppercase tracking-wider leading-none`}>
        {month}
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-0.5 leading-none">
        <span className={`${dims.day} font-black text-gray-800`}>{day}</span>
        <span className={`${dims.dow} font-semibold text-gray-500 uppercase tracking-wider`}>{dow}</span>
      </div>
    </div>
  )
}

// ============================================================================
//  AddToCalendarButton
//
//  Downloads an .ics file for the tournament. Two variants:
//    - 'full' → a pill-shaped CTA button with label (used in the post-reg popup)
//    - 'icon' → a small square icon button (used next to the date on the
//              event detail page and anywhere space is tight)
//
//  The .ics bakes in two alarms (24h before + 2h before) so the reminders
//  fire locally from the player's own calendar — no server-side push needed.
// ============================================================================

export function AddToCalendarButton({ tournament, variant = 'full', className = '', label }) {
  if (!tournament?.date) return null
  const handleClick = (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    downloadTournamentIcs(tournament)
  }

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label="Add to calendar"
        title="Add to your calendar"
        className={`w-9 h-9 flex items-center justify-center rounded-xl bg-lobster-cream text-lobster-teal active:scale-95 transition-all ${className}`}
      >
        <CalendarPlus size={16} />
      </button>
    )
  }

  // 'full' CTA — border style, softer than the primary payment actions so it
  // doesn't compete with the Tikkie / "I've paid" buttons.
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`w-full flex items-center justify-center gap-2 border-2 border-lobster-teal text-lobster-teal font-semibold py-3 rounded-2xl active:scale-95 transition-all ${className}`}
    >
      <CalendarPlus size={18} />
      {label || "Don't forget — add to calendar"}
    </button>
  )
}

// ============================================================================
//  ShareWhatsAppButton
//
//  Opens WhatsApp with a pre-filled message containing the event link, date,
//  time and name. The link points to ?event=<id> which the app picks up on
//  load and navigates to the registration page for that tournament.
//
//  Two variants: 'icon' (compact square) and 'full' (wide CTA pill).
// ============================================================================

export function ShareWhatsAppButton({ tournament, variant = 'icon', className = '' }) {
  if (!tournament?.id) return null

  const handleClick = (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()

    const baseUrl = window.location.origin + window.location.pathname
    const eventUrl = `${baseUrl}?event=${tournament.id}`

    const d = tournament.date ? new Date(tournament.date) : null
    const dateLine = d && !isNaN(d.getTime())
      ? d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : ''
    const timePart = tournament.time ? ` at ${tournament.time}` : ''
    const locationPart = tournament.location ? `\n${tournament.location}` : ''

    const text = [
      `🦞 ${tournament.name || 'Padel Lobsters Event'}`,
      dateLine ? `📅 ${dateLine}${timePart}` : '',
      locationPart ? `📍${locationPart}` : '',
      '',
      `Register & see details:`,
      eventUrl,
    ].filter(Boolean).join('\n')

    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(waUrl, '_blank')
  }

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label="Share on WhatsApp"
        title="Share on WhatsApp"
        className={`w-9 h-9 flex items-center justify-center rounded-xl bg-green-50 text-green-600 active:scale-95 transition-all ${className}`}
      >
        <Share2 size={16} />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`w-full flex items-center justify-center gap-2 border-2 border-green-500 text-green-600 font-semibold py-3 rounded-2xl active:scale-95 transition-all ${className}`}
    >
      <Share2 size={18} />
      Share on WhatsApp
    </button>
  )
}

export default AddToCalendarButton
