import { buildHistoricalAppearances, summariseAppearances } from '../../lib/playerHistory'
import { computeTournamentStandings } from '../../lib/standings'
import { TOURNAMENTS } from '../../data/historicalTournaments'

// Stable list of all possible review scenarios — used by the admin
// "Review breakdown" panel to surface what each branch produces.
//
// The 10 PERFORMANCE messages (the ones we actually designed) are tagged
// with `performance: true` so the breakdown panel can highlight them
// separately from welcome/historical/level-fallback scenarios.
export const REVIEW_SCENARIOS = [
  // ── The performance messages ───────────────────────────────────────────
  { id: 'last-place-elite', label: '🎯 Playtomic: Fake News', performance: true },
  { id: 'last-place', label: '💀 The Anchor', performance: true },
  { id: 'recent-winner', label: '🏆 Tournament winner', performance: true },
  { id: 'bridesmaid', label: '🥈 The Bridesmaid', performance: true },
  { id: 'rookie', label: '🆕 The Rookie', performance: true },
  { id: 'elite-bad-winrate', label: '🤔 The Gap', performance: true },
  { id: 'low-rated-secret', label: '🕵️ Secret Weapon', performance: true },
  { id: 'dominant', label: '💪 Dominant', performance: true },
  { id: 'quietly-winning', label: '💼 Quietly Winning', performance: true },
  { id: 'committed-loser', label: '🎁 Lovable Loser', performance: true },
  { id: 'quietly-losing', label: '😬 Quietly Losing', performance: true },
  { id: 'ironman', label: '🦁 The Ironman', performance: true },
  { id: 'ghost', label: '👻 The Ghost', performance: true },
  { id: 'mediocre', label: '🤷 Perfectly Mediocre', performance: true },

  // ── Historical / legacy-tournament context (only fires with alias map) ─
  { id: 'hist-multi-champion', label: '👑 Historical multi-champion' },
  { id: 'hist-champion', label: '🏅 Historical champion' },
  { id: 'hist-multi-podium', label: '🥈 Multi-podium veteran' },
  { id: 'hist-podium', label: '🥉 Historical podium' },
  { id: 'hist-veteran', label: '🛡️ Tournament veteran' },
  { id: 'hist-predates-app', label: '📜 Predates the app' },

  // ── Filler scenarios ───────────────────────────────────────────────────
  { id: 'shows-up-no-data', label: '📋 Registered, no match log' },
  { id: 'welcome', label: '👋 No history yet' },
  { id: 'level-low', label: '⚪️ Generic — low level' },
  { id: 'level-mid', label: '⚪️ Generic — mid level' },
  { id: 'level-high', label: '⚪️ Generic — high level' },
  { id: 'level-elite', label: '⚪️ Generic — elite level' },
]

// Returns a structured review so admins can see which branch fired.
// Existing callers wanting plain text should read `.text`.
export function corpReview(
  player,
  matches = [],
  registrations = [],
  tournaments = [],
  aliasMap = {},
) {
  const lvl = player.adjustedLevel || 0
  const name = (player.name || 'Employee').split(' ')[0]
  const pid = player.id

  const spid = String(pid)
  // Every review is prefixed with its scenario title (with emoji) so the
  // category is obvious at a glance. Generic level-fallback scenarios are
  // intentionally excluded — those are "no real data" filler and shouldn't
  // wear a badge.
  const UNTITLED_SCENARIOS = new Set([
    'welcome',
    'level-low',
    'level-mid',
    'level-high',
    'level-elite',
    'shows-up-no-data',
  ])
  const tag = (scenario, text) => {
    const label = REVIEW_SCENARIOS.find((s) => s.id === scenario)?.label || scenario
    const hasLabel = !UNTITLED_SCENARIOS.has(scenario)
    const finalText = hasLabel ? `${label} — ${text}` : text
    // `text` stays as-is for legacy callers (sample buckets etc.).
    // `body` is the description without the label prefix so the UI can
    // render the title with its own styling.
    return { text: finalText, body: text, scenario, scenarioLabel: label, hasLabel }
  }

  // ── Historical tournament signal (from player_aliases + History.jsx) ─────
  // Includes Dec 2025, Jan 2026, Mar 2026, Apr 2026 — events that pre-date
  // the in-app registration flow but are still part of each player's story.
  const historical = buildHistoricalAppearances(pid, aliasMap || {})
  const histSummary = summariseAppearances(historical)
  const hasHistory = historical.length > 0

  // ── Compute match stats ──────────────────────────────────────────────────
  // We fold the legacy History.jsx matches in with the in-app DB matches so
  // the 10 performance scenarios (dominant / mediocre / committed-loser etc.)
  // can actually fire for veterans whose play is mostly pre-app.
  const playedDb = matches.filter(
    (m) =>
      m.completed &&
      (m.team1Ids?.map(String).includes(spid) || m.team2Ids?.map(String).includes(spid)),
  )
  let dbWins = 0,
    dbLosses = 0
  playedDb.forEach((m) => {
    const onTeam1 = m.team1Ids?.map(String).includes(spid)
    const s1 = m.score1 ?? 0,
      s2 = m.score2 ?? 0
    if ((onTeam1 && s1 > s2) || (!onTeam1 && s2 > s1)) dbWins++
    else dbLosses++
  })
  const wins = dbWins + histSummary.won
  const losses = dbLosses + histSummary.lost
  const totalMatches = wins + losses
  const winRate = totalMatches >= 1 ? wins / totalMatches : null

  // ── Compute tournament attendance ────────────────────────────────────────
  const today = new Date()
  const pastTournaments = tournaments.filter(
    (t) => t.status === 'completed' || new Date(t.date) <= today,
  )
  const pastTournamentIds = new Set(pastTournaments.map((t) => String(t.id)))

  const dbAttendedIds = new Set(
    registrations
      .filter(
        (r) =>
          String(r.playerId) === spid &&
          r.status !== 'cancelled' &&
          pastTournamentIds.has(String(r.tournamentId)),
      )
      .map((r) => String(r.tournamentId)),
  )
  // tournamentsPlayed = DB regs + historical appearances (deduped on id) so
  // ironman/ghost compare against the *whole* tournament history, not just
  // what's been logged inside the app.
  const historicalNew = historical.filter((h) => !dbAttendedIds.has(String(h.id)))
  const tournamentsPlayed = dbAttendedIds.size + historicalNew.length
  // totalTournaments counts every past event we know about (DB + hardcoded history).
  const totalTournaments = pastTournaments.length + TOURNAMENTS.length
  const eventsAttended = tournamentsPlayed // alias for clarity below

  // ── Mixed-only attendance (for Ironman / Ghost) ─────────────────────────
  // Ladies events exclude half the roster by design, so attendance ratios
  // should be computed against mixed tournaments only. DB tournaments have
  // no explicit type in the schema — treat them all as mixed.
  const historicalMixed = historical.filter((h) => h.type !== 'ladies')
  const historicalMixedNew = historicalMixed.filter((h) => !dbAttendedIds.has(String(h.id)))
  const mixedTournamentsPlayed = dbAttendedIds.size + historicalMixedNew.length
  const totalMixedHistorical = TOURNAMENTS.filter((t) => t.type !== 'ladies').length
  const totalMixedTournaments = pastTournaments.length + totalMixedHistorical

  // ── Compute per-tournament ranks across all played events ───────────────
  // Uses the SAME ranking algorithm as Scores.jsx (total game points →
  // matches won → head-to-head) via the shared standings helper, so the
  // Lobster Review never contradicts the official standings screen.
  // We keep the full list so we can detect multi-event patterns (e.g. The
  // Anchor = 2+ last-place finishes), not just the most recent result.
  const dbTournamentRanks = []
  ;[...tournaments]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach((t) => {
      const standings = computeTournamentStandings(t.id, matches)
      if (standings.length < 4) return
      const pos = standings.findIndex((s) => String(s.id) === spid)
      if (pos >= 0) {
        dbTournamentRanks.push({ id: t.id, date: t.date, rank: pos + 1, total: standings.length })
      }
    })

  // Combine DB + historical into one flat list for multi-event pattern checks.
  const historicalRanks = historical
    .filter((h) => h.players >= 4)
    .map((h) => ({ id: h.id, date: h.date, rank: h.rank, total: h.players }))
  const allTournamentRanks = [...dbTournamentRanks, ...historicalRanks]
  const lastPlaceCount = allTournamentRanks.filter((r) => r.rank === r.total).length
  const podiumCount = allTournamentRanks.filter((r) => r.rank <= 3).length

  // "Most recent tournament rank" — prefer DB, fall back to historical.
  let lastTournamentRank = dbTournamentRanks[0]?.rank ?? null
  let lastTournamentTotal = dbTournamentRanks[0]?.total ?? null
  if (lastTournamentRank === null && historical.length > 0) {
    lastTournamentRank = historical[0].rank
    lastTournamentTotal = historical[0].players
  }

  // ── No tournament history at all (DB or historical) ─────────────────────
  if (tournamentsPlayed === 0 && !hasHistory) {
    const welcome = [
      `${name} hasn't played a tournament yet — which means the group hasn't seen what they can do. That needs to change. Sign up. Show up. Make it a story worth telling.`,
      `No tournament history yet. Every legend in this group started exactly here. The only difference between then and now is one registration. ${name}, the courts are waiting.`,
      `${name} is yet to compete. The good news: nobody knows what to expect, which is the best possible position to be in. Sign up for the next one and make some noise.`,
      `Tournament debut pending. ${name} has everything ahead of them — no losses on record, no limits set, no one to prove wrong yet. The best time to start is the next tournament.`,
    ]
    const idHash = String(player.id || '0')
      .split('')
      .reduce((acc, c) => acc + c.charCodeAt(0), 0)
    return tag('welcome', welcome[idHash % welcome.length])
  }

  // ── The 10 performance scenarios (priority block) ───────────────────────
  // These are the messages we actually designed for the Lobster Review.
  // They run on the COMBINED dataset (in-app DB + legacy History.jsx),
  // so a player with only historical match data still hits the right
  // bucket (dominant / mediocre / lovable-loser etc.).

  // 🏆 Tournament winner — won the most recent tournament
  // A fresh win is the most notable thing you can say about a player.
  if (lastTournamentRank === 1 && lastTournamentTotal >= 4) {
    return tag(
      'recent-winner',
      `Won the whole thing. Showed up, dominated, went home. The rest of the group is currently reviewing their life choices. ${name} is not available for comment — they're too busy being better than everyone else.`,
    )
  }

  // 🎯 Playtomic: Fake News — last in most recent tournament + high Playtomic
  if (
    lastTournamentRank !== null &&
    lastTournamentTotal >= 4 &&
    lastTournamentRank === lastTournamentTotal &&
    lvl >= 3.2
  ) {
    return tag(
      'last-place-elite',
      `A Playtomic rating of ${lvl.toFixed(1)} and yet — last place. Scientists are studying this. The data doesn't lie but it does appear to be deeply confused. A walking contradiction, somehow making the rest of us feel both inferior and hopeful at the same time.`,
    )
  }

  // 💀 The Anchor — has finished last in ≥2 tournaments across all history
  // Pattern-based, not single-event: someone who truly owns the bottom.
  if (lastPlaceCount >= 2) {
    return tag(
      'last-place',
      `${lastPlaceCount} last-place finishes and counting. Consistent, reliable, always there at the bottom holding the group together. Not everyone can win — someone has to make the winners feel good, and ${name} does this selflessly, every single time.`,
    )
  }

  // 🦁 The Ironman — attended EVERY mixed tournament we know about.
  // Ladies-only events are excluded (they exclude half the roster by
  // design), but EVERY mixed event — DB + historical — must be on the
  // attendance record. Checked BEFORE Bridesmaid so long-term commitment
  // beats a one-off podium finish.
  if (totalMixedTournaments >= 3 && mixedTournamentsPlayed === totalMixedTournaments) {
    return tag(
      'ironman',
      `Has attended every Lobster tournament. Rain, wind, scheduling conflicts, life events — none of it mattered. We're not sure if this is dedication or if they simply have nowhere else to be. Both are valid.`,
    )
  }

  // 👻 The Ghost — ≤33% mixed attendance across ≥3 known mixed events
  if (totalMixedTournaments >= 3 && mixedTournamentsPlayed / totalMixedTournaments <= 0.33) {
    return tag(
      'ghost',
      `Has appeared at approximately one tournament. Like a rare weather event — talked about, rarely witnessed. The group respects the mystery. Statistically, anything could happen next. Nobody knows. Not even ${name}.`,
    )
  }

  // 🥈 The Bridesmaid — finished 2nd or 3rd in the most recent tournament
  if (
    lastTournamentRank !== null &&
    (lastTournamentRank === 2 || lastTournamentRank === 3) &&
    lastTournamentTotal >= 4
  ) {
    const position = lastTournamentRank === 2 ? '2nd' : '3rd'
    return tag(
      'bridesmaid',
      `Finished ${position} at the most recent tournament. The podium, but not the top step. ${name} has mastered the art of being almost there — close enough to touch the trophy, far enough to go home without it. Tragic. Compelling. The committee remains quietly invested.`,
    )
  }

  // 🆕 The Rookie — has played, but the sample size is still embarrassing
  if (totalMatches >= 1 && totalMatches < 3) {
    return tag(
      'rookie',
      `${name} has played a match. Possibly two. That's it. That's the data. The committee is reserving judgement until the sample size stops being embarrassing. Potential is, technically, unlimited.`,
    )
  }

  // 🤔 The Gap — high Playtomic, low win rate
  if (lvl >= 3.2 && winRate !== null && winRate < 0.4 && totalMatches >= 3) {
    return tag(
      'elite-bad-winrate',
      `Playtomic says elite. Match results say… something else entirely. Currently the most expensive mystery in the group. Investigations are ongoing. The committee remains baffled and slightly impressed.`,
    )
  }

  // 🕵️ Secret Weapon — low Playtomic, suspiciously high win rate
  if (lvl < 2.8 && winRate !== null && winRate > 0.55 && totalMatches >= 3) {
    return tag(
      'low-rated-secret',
      `Low rating, suspiciously high win rate. Either sandbagging at a professional level or has discovered something the rest of us haven't.`,
    )
  }

  // 💪 Dominant — ≥65% win rate
  if (winRate !== null && winRate >= 0.65 && totalMatches >= 3) {
    return tag(
      'dominant',
      `Wins constantly. Shows up, wins, leaves. Has made winning look so routine that the group has started taking it personally. At this point, the committee is actively considering whether ${name} should remain eligible for the next invitation.`,
    )
  }

  // 💼 Quietly Winning — 55–64% win rate
  if (winRate !== null && winRate >= 0.55 && totalMatches >= 3) {
    return tag(
      'quietly-winning',
      `${name} wins more than they lose without making it into a personality. No victory laps, no trash talk — just a steady accumulation of Ws that nobody notices until someone checks the numbers. Underrated in the group, probably overrated in their own head. A healthy balance.`,
    )
  }

  // 🎁 Lovable Loser — <30% win rate
  if (winRate !== null && winRate < 0.3 && totalMatches >= 3) {
    return tag(
      'committed-loser',
      `Loses frequently, returns every time. This is either extraordinary mental resilience or a complete absence of self-preservation instinct. Either way, the courts wouldn't be the same without them. Truly the heart of the group.`,
    )
  }

  // 😬 Quietly Losing — 30–39% win rate
  if (winRate !== null && winRate < 0.4 && totalMatches >= 3) {
    return tag(
      'quietly-losing',
      `${name} loses slightly more than they win. Not catastrophically, not heroically — just enough to be frustrating. HR has described the pattern as "quietly below average," which ${name} has chosen to interpret as "quietly mysterious." We admire the framing.`,
    )
  }

  // 🤷 Perfectly Mediocre — win rate 40–54%, ≥3 matches
  if (winRate !== null && winRate >= 0.4 && totalMatches >= 3) {
    return tag(
      'mediocre',
      `A statistical masterpiece. Not good enough to be intimidating, not bad enough to be endearing. Just perfectly, beautifully average. The bell curve's favourite child.`,
    )
  }

  // ── Historical-tournament scenarios (secondary block) ───────────────────
  // For players whose record IS personal but doesn't fit any of the 10
  // performance buckets — surface a podium / champion / veteran line so the
  // review still feels tailored.

  // Multi-time champion across historical events
  if (histSummary.golds >= 2) {
    return tag(
      'hist-multi-champion',
      `${histSummary.golds} historical titles. ${name} has been winning Lobster Tournaments since before there was an app to record it. The data is not new. The dominance is not new. The rest of the group is, by now, used to it.`,
    )
  }

  // Recent historical champion
  if (histSummary.golds === 1) {
    const goldT = historical.find((h) => h.rank === 1)?.name?.replace('Lobster Tournament · ', '')
    return tag(
      'hist-champion',
      `Won ${goldT || 'a previous Lobster Tournament'}. The trophy may be metaphorical but the bragging rights are not. ${name} has receipts. The committee respects the receipts.`,
    )
  }

  // Multi-podium veteran
  if (histSummary.podiums >= 2) {
    return tag(
      'hist-multi-podium',
      `${histSummary.podiums} podium finishes across the legacy tournaments. ${name} doesn't always win, but they've been close enough, often enough, that the medal photographer knows them by name.`,
    )
  }

  // Single podium so far
  if (histSummary.podiums === 1 && eventsAttended >= 1) {
    const medal = histSummary.silvers ? '🥈 silver' : '🥉 bronze'
    return tag(
      'hist-podium',
      `Has a ${medal} on the historical record. ${name} has tasted the podium. The committee is monitoring whether this proves to be a launchpad or a peak.`,
    )
  }

  // Tournament veteran (3+ events with no podium yet)
  if (eventsAttended >= 3 && histSummary.podiums === 0) {
    return tag(
      'hist-veteran',
      `${eventsAttended} tournaments played. No podiums yet. The persistence is admirable, the stubbornness is documented, and the next one might just be the one. The group is rooting. Quietly.`,
    )
  }

  // Has historical attendance but the modern in-app data is thin —
  // surface their historical best so the review feels personal.
  if (hasHistory && tournamentsPlayed === 0 && totalMatches === 0) {
    const best = histSummary.bestRank
    const bestT = histSummary.bestRankTournamentName?.replace('Lobster Tournament · ', '')
    if (best && bestT) {
      return tag(
        'hist-predates-app',
        `${name} predates the app. Best historical finish: rank ${best} at ${bestT}. The new system has yet to capture them in action. Veterans are encouraged to register for the next one and let the modern record begin.`,
      )
    }
  }

  // Has tournament history but no completed match data recorded
  if (tournamentsPlayed >= 1 && totalMatches === 0) {
    const noData = [
      `${name} has shown up to tournaments. The official match record, however, has chosen to remain silent on what actually happened out there. Either the results were never logged, or ${name} plays matches that exist on a different plane of reality. The committee is intrigued and has requested more data.`,
      `${name} has been on the court. The scorecards, however, appear to have been left behind. We know they played. We just can't prove anything. The committee is treating this as an open investigation.`,
      `Present at ${tournamentsPlayed} tournament${tournamentsPlayed > 1 ? 's' : ''}. Match data: classified. Whether by choice or by accident, ${name}'s results remain a mystery wrapped in a lobster shell. We respect the enigma.`,
    ]
    const idHash = String(player.id || '0')
      .split('')
      .reduce((acc, c) => acc + c.charCodeAt(0), 0)
    return tag('shows-up-no-data', noData[idHash % noData.length])
  }

  // ── Fallback: level-based ─────────────────────────────────────────────────
  const low = [
    `Internal assessments confirm that ${name} is still, technically, learning padel. Leadership has described their progress as "visible." This is the most positive framing available to us at this time.`,
    `${name} shows up. They swing. Things happen — not always the intended things, but things. HR has flagged "presence" as a genuine strength and is working hard to find a second one.`,
    `${name}'s development metrics remain in an early phase. We want to be encouraging. We also want to be accurate. Balancing these two goals has made this the most difficult review in the organisation.`,
  ]
  const mid = [
    `${name} is, by all available data, fine. Not remarkable. Not a disaster. Fine. Writing this review took longer than expected.`,
    `${name} wins some, loses some, and generates very few strong opinions in any direction. HR has described this as "low-maintenance." We mean that as a compliment. Mostly.`,
    `${name} has successfully avoided both the top and the bottom of the leaderboard for the entire season. Whether this is strategy or coincidence, the result is the same: a perfectly adequate year. We have noted this.`,
  ]
  const high = [
    `${name} is genuinely good at this. We are not used to saying this without caveats. There are no caveats. Please do not tell ${name}. They may already know and we are concerned about what happens next.`,
    `The data on ${name} is, frankly, difficult to criticise. They win. They contribute. They do not create HR incidents. Leadership has described this as "ideal" and immediately moved on to people who are more complicated.`,
    `${name} is one of the better players in this group, a fact they are presumably aware of and hopefully managing with appropriate humility. We have no evidence of inappropriate humility. We are monitoring the situation.`,
  ]
  const elite = [
    `${name} is, statistically, too good for this group. We have chosen to view this as their problem. Our official position is that it raises the average and we benefit from the association. ${name} has not been told this.`,
    `HR has reviewed ${name}'s match data and formally acknowledged that it creates a benchmarking problem for everyone else in the group. This is considered a net positive. The rest of the group is divided on that assessment.`,
  ]
  const pool = lvl < 2 ? low : lvl < 3.5 ? mid : lvl < 5 ? high : elite
  const fallbackId =
    lvl < 2 ? 'level-low' : lvl < 3.5 ? 'level-mid' : lvl < 5 ? 'level-high' : 'level-elite'
  // hash works for both integer and UUID string IDs
  const idHash = String(player.id || '0')
    .split('')
    .reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return tag(fallbackId, pool[idHash % pool.length])
}
