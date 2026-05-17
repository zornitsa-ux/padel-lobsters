import React from 'react'
import { Calendar, Users, ChevronRight } from 'lucide-react'
import DateTile from '../../components/ui/DateTile'

// ── Lobster League tile ──────────────────────────────────
//     Same visual grammar as a tournament card (DateTile + title +
//     date range). Gated on admin / league admin / whitelisted
//     test players; once the league's visibility is flipped to
//     'all', drop the canSeeLeague check.
export default function LobsterLeagueTile({
  canSeeLeague,
  activeLeague,
  leagueRangeStart,
  leagueRangeEnd,
  leagueTeamCount,
  fmtLeagueDate,
  onNavigate,
}) {
  if (!canSeeLeague || !activeLeague) return null
  return (
    <button
      onClick={() => onNavigate('league')}
      className="w-full rounded-2xl p-4 text-left shadow-sm bg-gradient-to-br from-lobster-teal to-teal-700 text-white active:scale-[0.99] transition-all"
    >
      <div className="flex items-start gap-3">
        {leagueRangeStart && <DateTile date={leagueRangeStart} size="md" />}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">
            Lobster League
          </p>
          <h2 className="text-base sm:text-lg font-extrabold leading-tight break-words">
            {activeLeague.name}
          </h2>
          {(leagueRangeStart || leagueRangeEnd) && (
            <p className="text-sm font-semibold mt-1 flex items-center gap-1 opacity-90">
              <Calendar size={13} /> {fmtLeagueDate(leagueRangeStart)} –{' '}
              {fmtLeagueDate(leagueRangeEnd)}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs opacity-90">
            <span className="flex items-center gap-1">
              <Users size={12} /> {leagueTeamCount} teams
            </span>
            {activeLeague.signup_closes_at &&
              new Date(activeLeague.signup_closes_at).getTime() > Date.now() && (
                <span className="bg-yellow-300 text-gray-900 font-semibold px-2 py-0.5 rounded-full">
                  Sign-up open
                </span>
              )}
          </div>
        </div>
        <ChevronRight size={18} className="text-white/70 flex-shrink-0" />
      </div>
    </button>
  )
}
