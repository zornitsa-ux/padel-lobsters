import React from 'react'

// ============================================================================
//  DateTile
//
//  A classic calendar tear-off visual: tiny month banner on top, big day
//  number in the middle, day-of-week in small caps below. Used as the visual
//  anchor of every tournament tile and the event detail page — so players can
//  see at a glance which event is on which day.
// ============================================================================

export default function DateTile({ date, size = 'md', className = '' }) {
  if (!date) return null
  const d = new Date(date)
  if (isNaN(d.getTime())) return null
  const month = d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()
  const day = d.getDate()
  const dow = d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase()

  const dims =
    size === 'lg'
      ? { box: 'w-16 h-20', day: 'text-3xl', month: 'text-[10px] py-0.5', dow: 'text-[10px]' }
      : size === 'sm'
        ? { box: 'w-11 h-12', day: 'text-lg', month: 'text-[8px]  py-[1px]', dow: 'text-[8px]' }
        : { box: 'w-14 h-16', day: 'text-2xl', month: 'text-[9px]  py-0.5', dow: 'text-[9px]' } // md

  return (
    <div
      className={`${dims.box} bg-white rounded-xl border border-lobster-teal/40 flex flex-col items-stretch flex-shrink-0 overflow-hidden shadow-sm ${className}`}
    >
      <div
        className={`${dims.month} font-bold bg-lobster-teal text-white text-center uppercase tracking-wider leading-none`}
      >
        {month}
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-0.5 leading-none">
        <span className={`${dims.day} font-black text-gray-800`}>{day}</span>
        <span className={`${dims.dow} font-semibold text-gray-500 uppercase tracking-wider`}>
          {dow}
        </span>
      </div>
    </div>
  )
}
