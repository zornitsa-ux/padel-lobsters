import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, Calendar, ChevronDown, ChevronUp } from 'lucide-react'
import { toIso, fromIso, fmtShort } from './leagueHelpers'

function RangeCalendar({ start, end, onChange, minDate }) {
  // Cursor is the month currently rendered. Start on the earlier of the two
  // bounds, or today if nothing's set yet.
  const initialCursor = fromIso(start) || fromIso(end) || new Date()
  const [cursor, setCursor] = useState(
    new Date(initialCursor.getFullYear(), initialCursor.getMonth(), 1),
  )
  // Track which endpoint we're picking next: 'start' or 'end'.
  const [pickSide, setPickSide] = useState(start ? 'end' : 'start')

  const startD = fromIso(start)
  const endD = fromIso(end)
  const minD = fromIso(minDate)

  // Build the month grid: always 6 weeks of 7 days starting on Monday.
  const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const dayOfWeek = (firstOfMonth.getDay() + 6) % 7 // Mon=0 ... Sun=6
  const gridStart = new Date(firstOfMonth)
  gridStart.setDate(1 - dayOfWeek)
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return d
  })

  const isSame = (a, b) =>
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  const inRange = (d) => startD && endD && d >= startD && d <= endD
  const isDisabled = (d) => minD && d < minD

  const onPick = (d) => {
    if (isDisabled(d)) return
    const iso = toIso(d)
    if (pickSide === 'start' || !startD || d < startD) {
      // Start a new range anchored on this day. Clear end if it's now invalid.
      onChange({ start: iso, end: endD && d > endD ? null : end })
      setPickSide('end')
    } else {
      // Complete the range. If click equals existing start, treat as single-day.
      onChange({ start, end: iso })
      setPickSide('start')
    }
  }

  const monthLabel = cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const bump = (delta) => {
    const next = new Date(cursor)
    next.setMonth(cursor.getMonth() + delta)
    setCursor(next)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => bump(-1)}
          className="p-1.5 rounded-lg hover:bg-gray-100"
        >
          <ChevronLeft size={16} className="text-gray-500" />
        </button>
        <p className="text-sm font-bold text-gray-800">{monthLabel}</p>
        <button
          type="button"
          onClick={() => bump(1)}
          className="p-1.5 rounded-lg hover:bg-gray-100"
        >
          <ChevronRight size={16} className="text-gray-500" />
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 gap-0.5 text-[10px] font-bold text-gray-400 uppercase text-center">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5 text-xs">
        {days.map((d, i) => {
          const inThisMonth = d.getMonth() === cursor.getMonth()
          const isStart = isSame(d, startD)
          const isEnd = isSame(d, endD)
          const ranged = inRange(d) && !isStart && !isEnd
          const disabled = isDisabled(d)
          let cls = 'py-1.5 text-center rounded'
          if (disabled) cls += ' text-gray-300 cursor-not-allowed'
          else if (isStart || isEnd) cls += ' bg-lobster-teal text-white font-bold'
          else if (ranged) cls += ' bg-lobster-cream text-lobster-teal font-semibold'
          else if (inThisMonth) cls += ' text-gray-700 hover:bg-gray-100 cursor-pointer'
          else cls += ' text-gray-300 hover:bg-gray-50 cursor-pointer'
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onPick(d)}
              className={cls}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>

      {/* Summary + quick actions */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-[11px]">
        <span className="text-gray-500">
          {start || end ? (
            <>
              <span className="font-semibold text-gray-700">{fmtShort(start)}</span> →{' '}
              <span className="font-semibold text-gray-700">{fmtShort(end)}</span>
            </>
          ) : (
            <span className="italic">Click a day to set the start</span>
          )}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
            }}
            className="font-semibold text-lobster-teal"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => {
              onChange({ start: null, end: null })
              setPickSide('start')
            }}
            className="font-semibold text-gray-400 hover:text-gray-600"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}

// Toggleable field: a tappable summary row that expands into the calendar.
// Saves screen real estate until the admin is editing the phase.
export function PhaseRangeField({ label, hint, start, end, onChange, optional, minDate }) {
  const [open, setOpen] = useState(false)
  const summary =
    start && end
      ? `${fmtShort(start)} → ${fmtShort(end)}`
      : start
        ? `${fmtShort(start)} → …`
        : 'Select dates'
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="label">
          {label}
          {optional && <span className="font-normal text-gray-400 ml-1">(optional)</span>}
        </span>
        {hint && <span className="text-[10px] font-normal text-gray-400">{hint}</span>}
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all ${
          open
            ? 'border-lobster-teal bg-lobster-cream'
            : 'border-gray-200 bg-white hover:border-gray-300'
        }`}
      >
        <Calendar size={14} className="text-lobster-teal flex-shrink-0" />
        <span
          className={`flex-1 text-left text-sm ${start ? 'font-semibold text-gray-800' : 'text-gray-400'}`}
        >
          {summary}
        </span>
        {open ? (
          <ChevronUp size={14} className="text-gray-400" />
        ) : (
          <ChevronDown size={14} className="text-gray-400" />
        )}
      </button>
      {open && (
        <div className="mt-2">
          <RangeCalendar start={start} end={end} onChange={onChange} minDate={minDate} />
        </div>
      )}
    </div>
  )
}

export default RangeCalendar
