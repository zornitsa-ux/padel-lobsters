// ─────────────────────────────────────────────────────────────────────────────
// Ratings recompute — rebuilds every player's Glicko-2 rating from scratch
// using the chronological union of:
//   1. Historical tournaments hardcoded in History.jsx (DEC, JAN, MAR, APR…)
//   2. Match data stored in the database (T#5 onward)
//
// Idempotent: always recomputes from zero, so re-running never causes drift.
// Trigger this whenever the source data changes meaningfully:
//   - admin marks a tournament as completed
//   - admin adds/edits a player_aliases row (mapping a historical first-name
//     to a real player_id) — historical matches involving that name suddenly
//     become resolvable and should be folded back in
//   - admin clicks the "Recompute ratings" button on demand
//
// Names in historical matches are resolved through the player_aliases table.
// Matches where ANY of the four players has no alias are dropped (we don't
// have a player_id to update, so there's nothing to do). When the missing
// player eventually registers + gets aliased, a re-run picks them up.
// ─────────────────────────────────────────────────────────────────────────────

import { applyTournamentRatings } from './glicko2'
import { TOURNAMENTS as HISTORICAL_TOURNAMENTS } from '../components/History'

/**
 * Run a full recompute. Returns {playersUpdated, eventsProcessed, dropped}.
 * Persists results to public.players (learned_rating / learned_rd /
 * learned_volatility / learned_matches_count / learned_updated_at).
 *
 * @param {SupabaseClient} supabase
 * @returns {Promise<{playersUpdated:number, eventsProcessed:number, droppedMatches:number}>}
 */
export async function recomputeAllRatings(supabase) {
  // ── 1. Load mapping data ────────────────────────────────────────────────
  const [{ data: players }, { data: aliases }, { data: tournaments }, { data: dbMatches }] = await Promise.all([
    supabase.from('players_public').select('id, playtomic_level'),
    supabase.from('player_aliases').select('historical_name, player_id, skipped'),
    supabase.from('tournaments').select('id, date, status').order('date', { ascending: true }),
    supabase.from('matches').select('tournament_id, team1_ids, team2_ids, score1, score2, created_at'),
  ])

  if (!players) throw new Error('Could not load players')

  const playtomicByPid = Object.fromEntries(
    players.map(p => [p.id, Number(p.playtomic_level) || 0])
  )
  const aliasMap = new Map(
    (aliases || []).filter(a => !a.skipped).map(a => [a.historical_name, a.player_id])
  )

  // ── 2. Resolve historical (History.jsx) tournaments ─────────────────────
  let droppedMatches = 0
  const historicalEvents = (HISTORICAL_TOURNAMENTS || [])
    .filter(t => t.rounds && t.rounds.length > 0)
    .map(t => {
      const matches = []
      for (const round of t.rounds) {
        for (const m of (round.matches || [])) {
          const t1 = (m.t1 || []).map(n => aliasMap.get(n))
          const t2 = (m.t2 || []).map(n => aliasMap.get(n))
          if (t1.length === 2 && t2.length === 2 && t1.every(Boolean) && t2.every(Boolean)) {
            matches.push({ team1Ids: t1, team2Ids: t2, score1: m.s1, score2: m.s2 })
          } else {
            droppedMatches++
          }
        }
      }
      return { id: t.id, date: t.date, sortKey: parseEventDate(t.date), matches }
    })
    .filter(e => e.matches.length > 0)

  // ── 3. DB tournaments (only completed ones with scored matches) ─────────
  const dbEvents = (tournaments || [])
    .filter(t => t.status === 'completed')
    .map(t => {
      const matches = (dbMatches || [])
        .filter(m => m.tournament_id === t.id && m.score1 != null && m.score2 != null)
        .map(m => ({
          team1Ids: m.team1_ids, team2Ids: m.team2_ids,
          score1: m.score1, score2: m.score2,
        }))
      return { id: t.id, date: t.date, sortKey: parseEventDate(t.date), matches }
    })
    .filter(e => e.matches.length > 0)

  // ── 4. Sort chronologically and apply Glicko in order ───────────────────
  const allEvents = [...historicalEvents, ...dbEvents].sort((a, b) => a.sortKey - b.sortKey)

  let prior = {}
  const matchCount = {}    // playerId → cumulative match count across all events
  for (const event of allEvents) {
    const out = applyTournamentRatings(prior, event.matches, playtomicByPid)
    Object.entries(out).forEach(([id, r]) => {
      prior[id] = { rating: r.rating, rd: r.rd, volatility: r.volatility }
      matchCount[id] = (matchCount[id] || 0) + (r.matches || 0)
    })
  }

  // ── 5. Persist ──────────────────────────────────────────────────────────
  // Anon has no UPDATE on public.players, so the writeback goes through the
  // admin_persist_learned_ratings RPC (SECURITY DEFINER, gated by
  // verify_admin_pin). All callers of recomputeAllRatings already happen in
  // admin-only contexts (Settings.jsx button, Schedule.jsx finish-tournament,
  // AppContext.jsx alias save/remove), so the PIN should be in localStorage.
  const updates = Object.entries(prior).map(([id, r]) => ({
    id,
    learned_rating: r.rating,
    learned_rd: r.rd,
    learned_volatility: r.volatility,
    learned_matches_count: matchCount[id] || 0,
    learned_updated_at: new Date().toISOString(),
  }))

  const adminPin = (typeof localStorage !== 'undefined')
    ? localStorage.getItem('lobster_session_admin_pin')
    : null
  if (!adminPin) throw new Error('Admin sign-in required to persist ratings')

  const dbTournamentIds = dbEvents.map(e => e.id)
  const { error: persistError } = await supabase.rpc('admin_persist_learned_ratings', {
    input_admin_pin:              adminPin,
    input_updates:                updates,
    input_applied_tournament_ids: dbTournamentIds,
  })
  if (persistError) throw persistError

  return {
    playersUpdated: updates.length,
    eventsProcessed: allEvents.length,
    droppedMatches,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Date parser tolerant of all the formats History.jsx uses.
//
// Examples seen:
//   "December 2025"
//   "March 2026"
//   "2026-04-10"   (APR, ladies)
//   "2026-04-19"   (T#5 from DB)
// ─────────────────────────────────────────────────────────────────────────────
function parseEventDate(d) {
  if (!d) return 0
  const s = String(d).trim()
  // ISO date YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return Date.UTC(+iso[1], +iso[2] - 1, +iso[3])
  // Month name + year
  const monthMap = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  }
  const monthYear = s.match(/(\w+)\s+(\d{4})/)
  if (monthYear) {
    const m = monthMap[monthYear[1].toLowerCase()]
    if (m != null) return Date.UTC(+monthYear[2], m, 15)
  }
  // Fallback: parseable date string
  const t = Date.parse(s)
  return isNaN(t) ? 0 : t
}
