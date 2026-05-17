import React from 'react'
import { Flame } from 'lucide-react'

// ── Countdown flip clock + streak ────────────────────────
export default function CountdownClock({ countdown, streak }) {
  if (countdown) {
    return (
      <div className="text-center">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
          Next Lobster Event in
        </p>
        <div className="flex justify-center gap-2">
          <div className="bg-lobster-teal-dark rounded-xl w-16 py-2.5">
            <p className="text-2xl font-black text-white tabular-nums">
              {String(countdown.days).padStart(2, '0')}
            </p>
            <p className="text-[9px] text-white/60 font-medium mt-0.5">DAYS</p>
          </div>
          <div className="bg-lobster-teal-dark rounded-xl w-16 py-2.5">
            <p className="text-2xl font-black text-white tabular-nums">
              {String(countdown.hours).padStart(2, '0')}
            </p>
            <p className="text-[9px] text-white/60 font-medium mt-0.5">HOURS</p>
          </div>
          <div className="bg-lobster-teal-dark rounded-xl w-16 py-2.5">
            <p className="text-2xl font-black text-white tabular-nums">
              {String(countdown.mins).padStart(2, '0')}
            </p>
            <p className="text-[9px] text-white/60 font-medium mt-0.5">MIN</p>
          </div>
          <div className="bg-lobster-teal-dark rounded-xl w-16 py-2.5">
            <p className="text-2xl font-black text-white tabular-nums">
              {String(countdown.secs).padStart(2, '0')}
            </p>
            <p className="text-[9px] text-white/60 font-medium mt-0.5">SEC</p>
          </div>
        </div>
        {streak > 0 && (
          <p className="text-[11px] text-gray-500 font-semibold mt-2 flex items-center justify-center gap-1">
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
        <span className="text-[11px] bg-white border border-gray-200 text-gray-600 font-semibold px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5">
          <Flame size={13} className="text-orange-500" />
          {streak} event{streak > 1 ? 's' : ''} in a row
        </span>
      </div>
    )
  }
  return null
}
