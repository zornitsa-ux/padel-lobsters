import React from 'react'
import { Flame } from 'lucide-react'
import { Skeleton } from '../../components/ui/Skeleton'
import type { Countdown } from './useCountdown'

interface CountdownClockProps {
  countdown: Countdown | null
  streak: number
  /** No tournaments read yet — a missing clock would read as "no event coming". */
  loading?: boolean
}

// Four tiles matching the flip clock's w-16 boxes. 66px is the loaded tile's
// height (py-2.5 + the 2xl digit + the 9px label), so the clock swaps in
// without moving the card below it.
function CountdownSkeleton() {
  return (
    <div className="text-center" role="status" aria-busy="true">
      <span className="sr-only">Loading the countdown to the next event…</span>
      <p className="text-[10px] font-bold text-lob-muted-light uppercase tracking-widest mb-2">
        Next Lobster Event in
      </p>
      <div className="flex justify-center gap-2">
        {['days', 'hours', 'mins', 'secs'].map((unit) => (
          <Skeleton key={unit} className="w-16 h-[66px] rounded-xl" />
        ))}
      </div>
    </div>
  )
}

// ── Countdown flip clock + streak ────────────────────────
export default function CountdownClock({
  countdown,
  streak,
  loading = false,
}: CountdownClockProps) {
  if (loading) return <CountdownSkeleton />

  if (countdown) {
    return (
      <div className="text-center">
        <p className="text-[10px] font-bold text-lob-muted-light uppercase tracking-widest mb-2">
          Next Lobster Event in
        </p>
        <div className="flex justify-center gap-2">
          <div className="bg-lob-teal-dark rounded-xl w-16 py-2.5">
            <p className="text-2xl font-black text-white tabular-nums">
              {String(countdown.days).padStart(2, '0')}
            </p>
            <p className="text-[9px] text-white/60 font-medium mt-0.5">DAYS</p>
          </div>
          <div className="bg-lob-teal-dark rounded-xl w-16 py-2.5">
            <p className="text-2xl font-black text-white tabular-nums">
              {String(countdown.hours).padStart(2, '0')}
            </p>
            <p className="text-[9px] text-white/60 font-medium mt-0.5">HOURS</p>
          </div>
          <div className="bg-lob-teal-dark rounded-xl w-16 py-2.5">
            <p className="text-2xl font-black text-white tabular-nums">
              {String(countdown.mins).padStart(2, '0')}
            </p>
            <p className="text-[9px] text-white/60 font-medium mt-0.5">MIN</p>
          </div>
          <div className="bg-lob-teal-dark rounded-xl w-16 py-2.5">
            <p className="text-2xl font-black text-white tabular-nums">
              {String(countdown.secs).padStart(2, '0')}
            </p>
            <p className="text-[9px] text-white/60 font-medium mt-0.5">SEC</p>
          </div>
        </div>
        {streak > 0 && (
          <p className="text-[11px] text-lob-muted font-semibold mt-2 flex items-center justify-center gap-1">
            <Flame size={13} className="text-orange-500" />
            {streak} event{streak > 1 ? 's' : ''} in a row
          </p>
        )}
      </div>
    )
  }
  if (streak > 0) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[11px] bg-white border border-gray-200 text-lob-slate font-semibold px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5">
          <Flame size={13} className="text-orange-500" />
          {streak} event{streak > 1 ? 's' : ''} in a row
        </span>
      </div>
    )
  }
  return null
}
