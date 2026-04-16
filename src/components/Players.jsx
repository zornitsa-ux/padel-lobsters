import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../supabase'
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronUp, Search, User, Clock, Camera, Briefcase, Trophy, TrendingUp, GitMerge } from 'lucide-react'
// AdminLogin modal replaced by unified sign-in in Settings → Account
import CountryPicker, { COUNTRIES, countryFlag, FlagImg } from './CountryPicker'
import PlayerAliasMatcher from './PlayerAliasMatcher'
import { buildHistoricalAppearances, summariseAppearances } from '../lib/playerHistory'
import { computeTournamentStandings } from '../lib/standings'
import { TOURNAMENTS } from './History'

const LEVEL_COLORS = [
  'bg-gray-200 text-gray-700',
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-teal-100 text-teal-700',
  'bg-yellow-100 text-yellow-700',
  'bg-orange-100 text-orange-700',
  'bg-red-100 text-red-700',
  'bg-purple-100 text-purple-700',
]

// ── Player stats from match history ──────────────────────────────────────────
// Normalise a name for alias/first-name matching: lowercase + strip
// whitespace and common punctuation so "Gonzalo U" ≈ "gonzalou".
function _normHistName(s) {
  return String(s || '').toLowerCase().replace(/[\s.\-_]/g, '')
}

function buildPlayerStats(
  playerId,
  matches,
  tournaments,
  registrations,
  // New optional inputs — enable folding historical match records into the
  // per-player h2h / partners / streaks so veterans whose play predates the
  // in-app registration flow still get meaningful Rivalries & Chemistry.
  players = [],
  aliasMap = {},
  historicalTournaments = []
) {
  // ── Name → player_id resolver for historical matches ─────────────────
  // Priority: explicit alias map entries, then fall back to matching a
  // live player's first-name or full-name. Any historical name that
  // can't be resolved is still counted for the focal player's own
  // pointsFor / pointsAgainst / streaks (so long as *they* resolve), but
  // is skipped when building h2h / partner rows.
  const nameToId = new Map()
  Object.entries(aliasMap || {}).forEach(([name, pid]) => {
    if (name && pid) nameToId.set(_normHistName(name), pid)
  })
  players.forEach(pl => {
    if (!pl?.id || !pl?.name) return
    const first = _normHistName(String(pl.name).split(' ')[0])
    const full  = _normHistName(pl.name)
    if (first && !nameToId.has(first)) nameToId.set(first, pl.id)
    if (full  && !nameToId.has(full))  nameToId.set(full,  pl.id)
  })
  const resolveName = (n) => nameToId.get(_normHistName(n)) || null

  // ── Unified match list: DB matches + historical matches ──────────────
  // Each event is normalised into the same shape so a single loop below
  // can handle both sources identically. Streaks end up correct because
  // we sort chronologically before iterating.
  const events = []

  // DB matches (from Supabase)
  const completed = matches.filter(m => m.completed)
  completed.forEach(m => {
    const onT1 = (m.team1Ids || []).includes(playerId)
    const onT2 = (m.team2Ids || []).includes(playerId)
    if (!onT1 && !onT2) return
    const tournDate = tournaments.find(t => t.id === m.tournamentId)?.date || ''
    events.push({
      source: 'db',
      tournamentId: m.tournamentId,
      tournamentDate: tournDate,
      round: m.round || 0,
      myScore: parseInt(onT1 ? m.score1 : m.score2) || 0,
      theirScore: parseInt(onT1 ? m.score2 : m.score1) || 0,
      opponents: (onT1 ? (m.team2Ids || []) : (m.team1Ids || [])).filter(Boolean),
      teammates: (onT1 ? (m.team1Ids || []) : (m.team2Ids || []))
        .filter(id => id && id !== playerId),
    })
  })

  // Historical matches (from the hardcoded TOURNAMENTS list in History.jsx)
  ;(historicalTournaments || []).forEach(t => {
    if (!t?.rounds) return
    t.rounds.forEach(r => {
      (r.matches || []).forEach(m => {
        const t1Ids = (m.t1 || []).map(resolveName)
        const t2Ids = (m.t2 || []).map(resolveName)
        const onT1 = t1Ids.includes(playerId)
        const onT2 = t2Ids.includes(playerId)
        if (!onT1 && !onT2) return
        events.push({
          source: 'hist',
          tournamentId: `hist:${t.id}`,
          tournamentDate: t.date || '',
          round: r.round || 0,
          myScore: parseInt(onT1 ? m.s1 : m.s2) || 0,
          theirScore: parseInt(onT1 ? m.s2 : m.s1) || 0,
          opponents: (onT1 ? t2Ids : t1Ids).filter(Boolean),
          teammates: (onT1 ? t1Ids : t2Ids).filter(id => id && id !== playerId),
        })
      })
    })
  })

  // Chronological sort — oldest first — so streaks extend in real time.
  // Historical tournaments generally predate DB ones (Dec 2025 → present),
  // but we compare on parsed date anyway and fall back to a source tiebreak
  // (hist before db) for unparseable dates like "March 2026".
  events.sort((a, b) => {
    const da = Date.parse(a.tournamentDate)
    const db = Date.parse(b.tournamentDate)
    if (!isNaN(da) && !isNaN(db) && da !== db) return da - db
    if (a.source !== b.source) return a.source === 'hist' ? -1 : 1
    return (a.round || 0) - (b.round || 0)
  })

  let won = 0, lost = 0, draws = 0, pointsFor = 0, pointsAgainst = 0, points = 0
  let curWinStreak = 0, bestWinStreak = 0
  let curLossStreak = 0, worstLossStreak = 0
  const recentForm = [] // last 5: 'W' | 'L' | 'D'
  const h2h = {} // opponentId → { won, lost, draws }
  const h2hPairs = {} // "id1:id2" → { ids: [id1,id2], won, lost, draws }
  const partners = {} // partnerId → { wins, losses, games }
  const tournamentIds = new Set()

  events.forEach(e => {
    pointsFor += e.myScore
    pointsAgainst += e.theirScore
    points = pointsFor
    tournamentIds.add(e.tournamentId)

    let result
    if (e.myScore > e.theirScore) {
      won++; result = 'W'
      curWinStreak++; bestWinStreak = Math.max(bestWinStreak, curWinStreak)
      curLossStreak = 0
    } else if (e.myScore < e.theirScore) {
      lost++; result = 'L'
      curLossStreak++; worstLossStreak = Math.max(worstLossStreak, curLossStreak)
      curWinStreak = 0
    } else {
      draws++; result = 'D'
      curWinStreak = 0; curLossStreak = 0
    }
    recentForm.push(result)

    e.opponents.forEach(oppId => {
      if (!oppId) return
      if (!h2h[oppId]) h2h[oppId] = { won: 0, lost: 0, draws: 0 }
      if (result === 'W') h2h[oppId].won++
      else if (result === 'L') h2h[oppId].lost++
      else h2h[oppId].draws++
    })

    // Track opponent pairs (only the fully-resolved ones — partial pairs
    // would give misleading "you vs X+unknown" rows).
    const pairIds = [...e.opponents].filter(Boolean).sort()
    if (pairIds.length === 2) {
      const pairKey = pairIds.join(':')
      if (!h2hPairs[pairKey]) h2hPairs[pairKey] = { ids: pairIds, won: 0, lost: 0, draws: 0 }
      if (result === 'W') h2hPairs[pairKey].won++
      else if (result === 'L') h2hPairs[pairKey].lost++
      else h2hPairs[pairKey].draws++
    }

    e.teammates.forEach(tId => {
      if (!tId) return
      if (!partners[tId]) partners[tId] = { wins: 0, losses: 0, games: 0 }
      partners[tId].games++
      if (result === 'W') partners[tId].wins++
      else if (result === 'L') partners[tId].losses++
    })
  })

  // DB-only tournament list for the "Past tournaments" chip row — the
  // profile already has a dedicated Historical section powered by
  // buildHistoricalAppearances, so we don't want to duplicate those here.
  const dbTournIds = new Set(
    Array.from(tournamentIds).filter(id => !String(id).startsWith('hist:'))
  )
  const playerTournaments = tournaments
    .filter(t => dbTournIds.has(t.id))
    .sort((a, b) => (b.date || '') > (a.date || '') ? 1 : -1)

  const played = won + lost + draws

  return {
    played,
    won, lost, draws, points,
    pointsFor, pointsAgainst,
    pointDiff: pointsFor - pointsAgainst,
    avgPointsFor: played > 0 ? pointsFor / played : 0,
    avgPointsAgainst: played > 0 ? pointsAgainst / played : 0,
    winRate: played > 0 ? Math.round((won / played) * 100) : 0,
    recentForm: recentForm.slice(-5),
    bestWinStreak,
    worstLossStreak,
    h2h,
    h2hPairs,
    partners,
    playerTournaments,
  }
}

// Rotating fun prompts for the "notes" field shown at registration
const LOBBY_PROMPTS = [
  { label: '🎤 Trash Talk',        placeholder: 'Say something to your future opponents…' },
  { label: '🦞 Lobster Confession', placeholder: 'Confess your deepest padel sin…' },
  { label: '💬 War Cry',           placeholder: 'What do you scream before a match?' },
  { label: '🏅 Bold Claim',        placeholder: 'Make a promise you may not keep…' },
  { label: '🎯 Battle Cry',        placeholder: 'Inspire (or scare) your opponents…' },
  { label: '😤 Excuse Generator',  placeholder: 'Pre-write your excuse for losing today…' },
  { label: '🤝 Personal Pledge',   placeholder: 'What do you bring to the court?' },
  { label: '👀 Scouting Report',   placeholder: 'Describe your playing style in one line…' },
]
const randomPrompt = () => LOBBY_PROMPTS[Math.floor(Math.random() * LOBBY_PROMPTS.length)]

const emptyForm = {
  name: '', email: '', phone: '',
  playtomicLevel: '', adjustment: '0',
  playtomicUsername: '', notes: '', gender: '',
  isLeftHanded: false, country: '',
  avatarUrl: '', birthday: '',
  preferredPosition: '',
}

// Country data and picker imported from ./CountryPicker

// Stable list of all possible review scenarios — used by the admin
// "Review breakdown" panel to surface what each branch produces.
//
// The 10 PERFORMANCE messages (the ones we actually designed) are tagged
// with `performance: true` so the breakdown panel can highlight them
// separately from welcome/historical/level-fallback scenarios.
const REVIEW_SCENARIOS = [
  // ── The performance messages ───────────────────────────────────────────
  { id: 'last-place-elite',     label: '🎯 Playtomic: Fake News',     performance: true },
  { id: 'last-place',           label: '💀 The Anchor',               performance: true },
  { id: 'recent-winner',        label: '🏆 Tournament winner',         performance: true },
  { id: 'bridesmaid',           label: '🥈 The Bridesmaid',            performance: true },
  { id: 'rookie',               label: '🆕 The Rookie',                performance: true },
  { id: 'elite-bad-winrate',    label: '🤔 The Gap',                   performance: true },
  { id: 'low-rated-secret',     label: '🕵️ Secret Weapon',             performance: true },
  { id: 'dominant',             label: '💪 Dominant',                  performance: true },
  { id: 'quietly-winning',      label: '💼 Quietly Winning',           performance: true },
  { id: 'committed-loser',      label: '🎁 Lovable Loser',             performance: true },
  { id: 'quietly-losing',       label: '😬 Quietly Losing',            performance: true },
  { id: 'ironman',              label: '🦁 The Ironman',               performance: true },
  { id: 'ghost',                label: '👻 The Ghost',                 performance: true },
  { id: 'mediocre',             label: '🤷 Perfectly Mediocre',        performance: true },

  // ── Historical / legacy-tournament context (only fires with alias map) ─
  { id: 'hist-multi-champion',  label: '👑 Historical multi-champion' },
  { id: 'hist-champion',        label: '🏅 Historical champion' },
  { id: 'hist-multi-podium',    label: '🥈 Multi-podium veteran' },
  { id: 'hist-podium',          label: '🥉 Historical podium' },
  { id: 'hist-veteran',         label: '🛡️ Tournament veteran' },
  { id: 'hist-predates-app',    label: '📜 Predates the app' },

  // ── Filler scenarios ───────────────────────────────────────────────────
  { id: 'shows-up-no-data',     label: '📋 Registered, no match log' },
  { id: 'welcome',              label: '👋 No history yet' },
  { id: 'level-low',            label: '⚪️ Generic — low level' },
  { id: 'level-mid',            label: '⚪️ Generic — mid level' },
  { id: 'level-high',           label: '⚪️ Generic — high level' },
  { id: 'level-elite',          label: '⚪️ Generic — elite level' },
]

// Returns a structured review so admins can see which branch fired.
// Existing callers wanting plain text should read `.text`.
function corpReview(player, matches = [], registrations = [], tournaments = [], aliasMap = {}) {
  const lvl  = player.adjustedLevel || 0
  const name = (player.name || 'Employee').split(' ')[0]
  const pid  = player.id

  const spid = String(pid)
  // Every review is prefixed with its scenario title (with emoji) so the
  // category is obvious at a glance. Generic level-fallback scenarios are
  // intentionally excluded — those are "no real data" filler and shouldn't
  // wear a badge.
  const UNTITLED_SCENARIOS = new Set([
    'welcome',
    'level-low', 'level-mid', 'level-high', 'level-elite',
    'shows-up-no-data',
  ])
  const tag  = (scenario, text) => {
    const label = REVIEW_SCENARIOS.find(s => s.id === scenario)?.label || scenario
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
  const playedDb = matches.filter(m =>
    m.completed && (
      m.team1Ids?.map(String).includes(spid) ||
      m.team2Ids?.map(String).includes(spid)
    )
  )
  let dbWins = 0, dbLosses = 0
  playedDb.forEach(m => {
    const onTeam1 = m.team1Ids?.map(String).includes(spid)
    const s1 = m.score1 ?? 0, s2 = m.score2 ?? 0
    if ((onTeam1 && s1 > s2) || (!onTeam1 && s2 > s1)) dbWins++
    else dbLosses++
  })
  const wins   = dbWins   + histSummary.won
  const losses = dbLosses + histSummary.lost
  const totalMatches = wins + losses
  const winRate = totalMatches >= 1 ? wins / totalMatches : null

  // ── Compute tournament attendance ────────────────────────────────────────
  const today = new Date()
  const pastTournaments = tournaments.filter(t => t.status === 'completed' || new Date(t.date) <= today)
  const pastTournamentIds = new Set(pastTournaments.map(t => String(t.id)))

  const dbAttendedIds = new Set(
    registrations
      .filter(r =>
        String(r.playerId) === spid &&
        r.status !== 'cancelled' &&
        pastTournamentIds.has(String(r.tournamentId))
      )
      .map(r => String(r.tournamentId))
  )
  // tournamentsPlayed = DB regs + historical appearances (deduped on id) so
  // ironman/ghost compare against the *whole* tournament history, not just
  // what's been logged inside the app.
  const historicalNew = historical.filter(h => !dbAttendedIds.has(String(h.id)))
  const tournamentsPlayed = dbAttendedIds.size + historicalNew.length
  // totalTournaments counts every past event we know about (DB + hardcoded history).
  const totalTournaments = pastTournaments.length + TOURNAMENTS.length
  const eventsAttended = tournamentsPlayed  // alias for clarity below

  // ── Mixed-only attendance (for Ironman / Ghost) ─────────────────────────
  // Ladies events exclude half the roster by design, so attendance ratios
  // should be computed against mixed tournaments only. DB tournaments have
  // no explicit type in the schema — treat them all as mixed.
  const historicalMixed   = historical.filter(h => h.type !== 'ladies')
  const historicalMixedNew = historicalMixed.filter(h => !dbAttendedIds.has(String(h.id)))
  const mixedTournamentsPlayed = dbAttendedIds.size + historicalMixedNew.length
  const totalMixedHistorical   = TOURNAMENTS.filter(t => t.type !== 'ladies').length
  const totalMixedTournaments  = pastTournaments.length + totalMixedHistorical

  // ── Compute per-tournament ranks across all played events ───────────────
  // Uses the SAME ranking algorithm as Scores.jsx (total game points →
  // matches won → head-to-head) via the shared standings helper, so the
  // Lobster Review never contradicts the official standings screen.
  // We keep the full list so we can detect multi-event patterns (e.g. The
  // Anchor = 2+ last-place finishes), not just the most recent result.
  const dbTournamentRanks = []
  ;[...tournaments].sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(t => {
    const standings = computeTournamentStandings(t.id, matches)
    if (standings.length < 4) return
    const pos = standings.findIndex(s => String(s.id) === spid)
    if (pos >= 0) {
      dbTournamentRanks.push({ id: t.id, date: t.date, rank: pos + 1, total: standings.length })
    }
  })

  // Combine DB + historical into one flat list for multi-event pattern checks.
  const historicalRanks = historical
    .filter(h => h.players >= 4)
    .map(h => ({ id: h.id, date: h.date, rank: h.rank, total: h.players }))
  const allTournamentRanks = [...dbTournamentRanks, ...historicalRanks]
  const lastPlaceCount = allTournamentRanks.filter(r => r.rank === r.total).length
  const podiumCount    = allTournamentRanks.filter(r => r.rank <= 3).length

  // "Most recent tournament rank" — prefer DB, fall back to historical.
  let lastTournamentRank  = dbTournamentRanks[0]?.rank  ?? null
  let lastTournamentTotal = dbTournamentRanks[0]?.total ?? null
  if (lastTournamentRank === null && historical.length > 0) {
    lastTournamentRank  = historical[0].rank
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
    const idHash = String(player.id || '0').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
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
    return tag('recent-winner', `Won the whole thing. Showed up, dominated, went home. The rest of the group is currently reviewing their life choices. ${name} is not available for comment — they're too busy being better than everyone else.`)
  }

  // 🎯 Playtomic: Fake News — last in most recent tournament + high Playtomic
  if (lastTournamentRank !== null && lastTournamentTotal >= 4 && lastTournamentRank === lastTournamentTotal && lvl >= 3.2) {
    return tag('last-place-elite', `A Playtomic rating of ${lvl.toFixed(1)} and yet — last place. Scientists are studying this. The data doesn't lie but it does appear to be deeply confused. A walking contradiction, somehow making the rest of us feel both inferior and hopeful at the same time.`)
  }

  // 💀 The Anchor — has finished last in ≥2 tournaments across all history
  // Pattern-based, not single-event: someone who truly owns the bottom.
  if (lastPlaceCount >= 2) {
    return tag('last-place', `${lastPlaceCount} last-place finishes and counting. Consistent, reliable, always there at the bottom holding the group together. Not everyone can win — someone has to make the winners feel good, and ${name} does this selflessly, every single time.`)
  }

  // 🦁 The Ironman — attended EVERY mixed tournament we know about.
  // Ladies-only events are excluded (they exclude half the roster by
  // design), but EVERY mixed event — DB + historical — must be on the
  // attendance record. Checked BEFORE Bridesmaid so long-term commitment
  // beats a one-off podium finish.
  if (totalMixedTournaments >= 3 && mixedTournamentsPlayed === totalMixedTournaments) {
    return tag('ironman', `Has attended every Lobster tournament. Rain, wind, scheduling conflicts, life events — none of it mattered. We're not sure if this is dedication or if they simply have nowhere else to be. Both are valid.`)
  }

  // 👻 The Ghost — ≤33% mixed attendance across ≥3 known mixed events
  if (totalMixedTournaments >= 3 && mixedTournamentsPlayed / totalMixedTournaments <= 0.33) {
    return tag('ghost', `Has appeared at approximately one tournament. Like a rare weather event — talked about, rarely witnessed. The group respects the mystery. Statistically, anything could happen next. Nobody knows. Not even ${name}.`)
  }

  // 🥈 The Bridesmaid — finished 2nd or 3rd in the most recent tournament
  if (lastTournamentRank !== null && (lastTournamentRank === 2 || lastTournamentRank === 3) && lastTournamentTotal >= 4) {
    const position = lastTournamentRank === 2 ? '2nd' : '3rd'
    return tag('bridesmaid', `Finished ${position} at the most recent tournament. The podium, but not the top step. ${name} has mastered the art of being almost there — close enough to touch the trophy, far enough to go home without it. Tragic. Compelling. The committee remains quietly invested.`)
  }

  // 🆕 The Rookie — has played, but the sample size is still embarrassing
  if (totalMatches >= 1 && totalMatches < 3) {
    return tag('rookie', `${name} has played a match. Possibly two. That's it. That's the data. The committee is reserving judgement until the sample size stops being embarrassing. Potential is, technically, unlimited.`)
  }

  // 🤔 The Gap — high Playtomic, low win rate
  if (lvl >= 3.2 && winRate !== null && winRate < 0.40 && totalMatches >= 3) {
    return tag('elite-bad-winrate', `Playtomic says elite. Match results say… something else entirely. Currently the most expensive mystery in the group. Investigations are ongoing. The committee remains baffled and slightly impressed.`)
  }

  // 🕵️ Secret Weapon — low Playtomic, suspiciously high win rate
  if (lvl < 2.8 && winRate !== null && winRate > 0.55 && totalMatches >= 3) {
    return tag('low-rated-secret', `Low rating, suspiciously high win rate. Either sandbagging at a professional level or has discovered something the rest of us haven't.`)
  }

  // 💪 Dominant — ≥65% win rate
  if (winRate !== null && winRate >= 0.65 && totalMatches >= 3) {
    return tag('dominant', `Wins constantly. Shows up, wins, leaves. Has made winning look so routine that the group has started taking it personally. At this point, the committee is actively considering whether ${name} should remain eligible for the next invitation.`)
  }

  // 💼 Quietly Winning — 55–64% win rate
  if (winRate !== null && winRate >= 0.55 && totalMatches >= 3) {
    return tag('quietly-winning', `${name} wins more than they lose without making it into a personality. No victory laps, no trash talk — just a steady accumulation of Ws that nobody notices until someone checks the numbers. Underrated in the group, probably overrated in their own head. A healthy balance.`)
  }

  // 🎁 Lovable Loser — <30% win rate
  if (winRate !== null && winRate < 0.30 && totalMatches >= 3) {
    return tag('committed-loser', `Loses frequently, returns every time. This is either extraordinary mental resilience or a complete absence of self-preservation instinct. Either way, the courts wouldn't be the same without them. Truly the heart of the group.`)
  }

  // 😬 Quietly Losing — 30–39% win rate
  if (winRate !== null && winRate < 0.40 && totalMatches >= 3) {
    return tag('quietly-losing', `${name} loses slightly more than they win. Not catastrophically, not heroically — just enough to be frustrating. HR has described the pattern as "quietly below average," which ${name} has chosen to interpret as "quietly mysterious." We admire the framing.`)
  }

  // 🤷 Perfectly Mediocre — win rate 40–54%, ≥3 matches
  if (winRate !== null && winRate >= 0.40 && totalMatches >= 3) {
    return tag('mediocre', `A statistical masterpiece. Not good enough to be intimidating, not bad enough to be endearing. Just perfectly, beautifully average. The bell curve's favourite child.`)
  }

  // ── Historical-tournament scenarios (secondary block) ───────────────────
  // For players whose record IS personal but doesn't fit any of the 10
  // performance buckets — surface a podium / champion / veteran line so the
  // review still feels tailored.

  // Multi-time champion across historical events
  if (histSummary.golds >= 2) {
    return tag('hist-multi-champion', `${histSummary.golds} historical titles. ${name} has been winning Lobster Tournaments since before there was an app to record it. The data is not new. The dominance is not new. The rest of the group is, by now, used to it.`)
  }

  // Recent historical champion
  if (histSummary.golds === 1) {
    const goldT = historical.find(h => h.rank === 1)?.name?.replace('Lobster Tournament · ', '')
    return tag('hist-champion', `Won ${goldT || 'a previous Lobster Tournament'}. The trophy may be metaphorical but the bragging rights are not. ${name} has receipts. The committee respects the receipts.`)
  }

  // Multi-podium veteran
  if (histSummary.podiums >= 2) {
    return tag('hist-multi-podium', `${histSummary.podiums} podium finishes across the legacy tournaments. ${name} doesn't always win, but they've been close enough, often enough, that the medal photographer knows them by name.`)
  }

  // Single podium so far
  if (histSummary.podiums === 1 && eventsAttended >= 1) {
    const medal = histSummary.silvers ? '🥈 silver' : '🥉 bronze'
    return tag('hist-podium', `Has a ${medal} on the historical record. ${name} has tasted the podium. The committee is monitoring whether this proves to be a launchpad or a peak.`)
  }

  // Tournament veteran (3+ events with no podium yet)
  if (eventsAttended >= 3 && histSummary.podiums === 0) {
    return tag('hist-veteran', `${eventsAttended} tournaments played. No podiums yet. The persistence is admirable, the stubbornness is documented, and the next one might just be the one. The group is rooting. Quietly.`)
  }

  // Has historical attendance but the modern in-app data is thin —
  // surface their historical best so the review feels personal.
  if (hasHistory && tournamentsPlayed === 0 && totalMatches === 0) {
    const best = histSummary.bestRank
    const bestT = histSummary.bestRankTournamentName?.replace('Lobster Tournament · ', '')
    if (best && bestT) {
      return tag('hist-predates-app', `${name} predates the app. Best historical finish: rank ${best} at ${bestT}. The new system has yet to capture them in action. Veterans are encouraged to register for the next one and let the modern record begin.`)
    }
  }

  // Has tournament history but no completed match data recorded
  if (tournamentsPlayed >= 1 && totalMatches === 0) {
    const noData = [
      `${name} has shown up to tournaments. The official match record, however, has chosen to remain silent on what actually happened out there. Either the results were never logged, or ${name} plays matches that exist on a different plane of reality. The committee is intrigued and has requested more data.`,
      `${name} has been on the court. The scorecards, however, appear to have been left behind. We know they played. We just can't prove anything. The committee is treating this as an open investigation.`,
      `Present at ${tournamentsPlayed} tournament${tournamentsPlayed > 1 ? 's' : ''}. Match data: classified. Whether by choice or by accident, ${name}'s results remain a mystery wrapped in a lobster shell. We respect the enigma.`,
    ]
    const idHash = String(player.id || '0').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
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
  const fallbackId = lvl < 2 ? 'level-low' : lvl < 3.5 ? 'level-mid' : lvl < 5 ? 'level-high' : 'level-elite'
  // hash works for both integer and UUID string IDs
  const idHash = String(player.id || '0').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return tag(fallbackId, pool[idHash % pool.length])
}

// ── Player avatar component ───────────────────────────────────────────────────
function PlayerAvatar({ player, size = 'md', className = '' }) {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-lg' }
  const cls = sizes[size] || sizes.md
  if (player.avatarUrl) {
    return (
      <img
        src={player.avatarUrl}
        alt={player.name}
        className={`${cls} rounded-full object-cover flex-shrink-0 ${className}`}
        onError={e => { e.target.style.display = 'none'; e.target.nextSibling?.style && (e.target.nextSibling.style.display = 'flex') }}
      />
    )
  }
  return (
    <div className={`${cls} bg-lobster-teal rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${className}`}>
      {(player.name || '?')[0].toUpperCase()}
    </div>
  )
}

export default function Players({ onNavigate, focusPlayerId }) {
  const { players, addPlayer, updatePlayer, deletePlayer, isAdmin, claimedId, matches, registrations, tournaments, regeneratePin, fetchAllPlayersWithPii, playerAliases } = useApp()

  // ── Admin PII overlay ───────────────────────────────────────────────
  // After Phase 3 locks down players.email/phone/birthday from the anon
  // key, the `players` array we get from context (fed by players_public)
  // won't carry those fields. While admin is signed in we fetch the
  // full-PII rows via the admin-gated RPC and overlay them by id.
  const [piiById, setPiiById] = useState({})
  useEffect(() => {
    if (!isAdmin) { setPiiById({}); return }
    let cancelled = false
    ;(async () => {
      const rows = await fetchAllPlayersWithPii()
      if (cancelled || !rows) return
      const map = {}
      for (const r of rows) {
        map[r.id] = {
          email:    r.email    ?? '',
          phone:    r.phone    ?? '',
          birthday: r.birthday ?? '',
          notes:    r.notes    ?? '',
          pin:      r.pin      ?? '',
        }
      }
      setPiiById(map)
    })()
    return () => { cancelled = true }
  }, [isAdmin, fetchAllPlayersWithPii])

  // Merge a player record with the admin PII overlay. Non-admins get the
  // record unchanged (which means empty PII fields after Phase 3 — fine,
  // the admin-gated UI hides those fields anyway).
  const withPii = (p) => {
    if (!p) return p
    const extra = piiById[p.id]
    if (!extra) return p
    return {
      ...p,
      email:    extra.email    || p.email    || '',
      phone:    extra.phone    || p.phone    || '',
      birthday: extra.birthday || p.birthday || '',
      notes:    extra.notes    || p.notes    || '',
      pin:      extra.pin      || p.pin      || '',
    }
  }
  const [showForm, setShowForm]     = useState(false)
  const [editId, setEditId]         = useState(null)
  const [form, setForm]             = useState(emptyForm)
  const [lobbyPrompt, setLobbyPrompt] = useState(randomPrompt)
  const [search, setSearch]         = useState('')
  const [expandedId, setExpandedId] = useState(focusPlayerId || null)
  const focusRef = useRef(null)

  // Auto-scroll to focused player card
  useEffect(() => {
    if (focusPlayerId && focusRef.current) {
      setTimeout(() => {
        focusRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 150)
    }
  }, [focusPlayerId])
  const [saving, setSaving]         = useState(false)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [mergePlayer, setMergePlayer] = useState(null)   // existing player found by name
  const [pinReveal, setPinReveal]     = useState(null)   // { name, pin } — shown after registration
  const [linkModal, setLinkModal]     = useState(null)   // pending player being linked { pendingPlayer }
  const [linkSearch, setLinkSearch]   = useState('')     // search in link modal
  const [showAliasMatcher, setShowAliasMatcher] = useState(false) // admin: tag historical names → players
  const fileInputRef = useRef(null)

  // Overlay admin PII onto every record up-front so downstream filtering,
  // rendering, and form-fill calls just see the merged object.
  const playersWithPii = useMemo(() => players.map(withPii), [players, piiById])
  const activePlayers  = playersWithPii.filter(p => (p.status || 'active') === 'active')
  const pendingPlayers = playersWithPii.filter(p => p.status === 'pending')

  const filtered = activePlayers.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  )
  // Chronological order — first to join is #1, newest joiner is last.
  // Falls back to id ordering if created_at is missing on a record.
  const sorted = [...filtered].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0
    if (ta !== tb) return ta - tb
    return String(a.id).localeCompare(String(b.id))
  })

  // ── Review breakdown ─────────────────────────────────────────────────────
  // Run corpReview for every active player so we can group them by which
  // scenario fired. Drives both the header counter and the admin-only
  // breakdown panel that lists each scenario with its message + matched
  // players. Recomputes whenever the underlying data changes.
  const reviewBreakdown = useMemo(() => {
    const byScenario = new Map()
    REVIEW_SCENARIOS.forEach(s => {
      byScenario.set(s.id, { id: s.id, label: s.label, players: [], samples: new Map() })
    })
    activePlayers.forEach(p => {
      const r = corpReview(p, matches, registrations, tournaments, playerAliases)
      let bucket = byScenario.get(r.scenario)
      if (!bucket) {
        bucket = { id: r.scenario, label: r.scenarioLabel, players: [], samples: new Map() }
        byScenario.set(r.scenario, bucket)
      }
      bucket.players.push({ id: p.id, name: p.name })
      // De-dupe identical message variants so we can show how many flavours
      // of the same scenario are actually in play.
      const v = bucket.samples.get(r.text)
      if (v) v.count++
      else bucket.samples.set(r.text, { text: r.text, count: 1 })
    })
    return [...byScenario.values()]
      .filter(b => b.players.length > 0)
      .sort((a, b) => b.players.length - a.players.length)
  }, [activePlayers, matches, registrations, tournaments, playerAliases])

  // A scenario is "generic" if it's the level-based fallback or the welcome
  // line — everything else is personalised by tournament/match data.
  const GENERIC_IDS = new Set(['level-low', 'level-mid', 'level-high', 'level-elite', 'welcome'])
  const genericCount = reviewBreakdown
    .filter(b => GENERIC_IDS.has(b.id))
    .reduce((n, b) => n + b.players.length, 0)
  const personalisedCount = activePlayers.length - genericCount

  const [showReviewBreakdown, setShowReviewBreakdown] = useState(false)

  // ── Name display: first name only; both players get a surname initial
  //    the moment a duplicate first name exists in the group ────────────────
  const firstNameCount = {}
  activePlayers.forEach(p => {
    const fn = (p.name || '').trim().split(/\s+/)[0]
    firstNameCount[fn] = (firstNameCount[fn] || 0) + 1
  })
  const displayName = (p) => {
    const parts = (p.name || '').trim().split(/\s+/)
    const fn = parts[0] || '?'
    if (firstNameCount[fn] > 1 && parts.length > 1) {
      return `${fn} ${parts[1][0].toUpperCase()}`
    }
    return fn
  }

  const openAdd = () => {
    setForm(emptyForm); setEditId(null); setAvatarFile(null); setAvatarPreview(null); setMergePlayer(null)
    setLobbyPrompt(randomPrompt())
    setShowForm(true)
  }

  // Debounced duplicate check — fires 400ms after the user stops typing the name.
  // Reliable on both desktop and mobile (doesn't depend on onBlur).
  const mergeDebounceRef = useRef(null)
  useEffect(() => {
    if (editId) return  // never prompt when already editing
    clearTimeout(mergeDebounceRef.current)
    mergeDebounceRef.current = setTimeout(() => {
      const typed = form.name.trim().toLowerCase()
      if (typed.split(/\s+/).length < 2) { setMergePlayer(null); return }
      const found = players.find(p =>
        (p.name || '').trim().toLowerCase() === typed
      )
      setMergePlayer(found || null)
    }, 400)
    return () => clearTimeout(mergeDebounceRef.current)
  }, [form.name, editId])

  // Accept merge: pre-fill form with existing player data, switch to update mode
  const acceptMerge = () => {
    // Re-resolve through the PII-overlay so email/phone/birthday are
    // filled in if admin has fetched them.
    const p = withPii(mergePlayer)
    setForm({
      name: p.name || '',
      email: p.email || '',
      phone: p.phone || '',
      playtomicLevel: p.playtomicLevel ?? '',
      adjustment: p.adjustment ?? '0',
      playtomicUsername: p.playtomicUsername || '',
      notes: p.notes || '',
      gender: p.gender || '',
      isLeftHanded: p.isLeftHanded || false,
      country: p.country || '',
      avatarUrl: p.avatarUrl || '',
      birthday: p.birthday || '',
    })
    setAvatarPreview(p.avatarUrl || null)
    setEditId(p.id)
    setMergePlayer(null)
  }

  const openEdit = (p) => {
    if (!isAdmin) { onNavigate?.('settings'); return }
    setForm({
      name: p.name || '', email: p.email || '', phone: p.phone || '',
      playtomicLevel: p.playtomicLevel ?? '', adjustment: p.adjustment ?? '0',
      playtomicUsername: p.playtomicUsername || '', notes: p.notes || '',
      gender: p.gender || '', isLeftHanded: p.isLeftHanded || false,
      country: p.country || '',
      avatarUrl: p.avatarUrl || '',
      birthday: p.birthday || '',
      preferredPosition: p.preferredPosition || '',
    })
    setAvatarFile(null)
    setAvatarPreview(p.avatarUrl || null)
    setEditId(p.id); setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!isAdmin) { onNavigate?.('settings'); return }
    if (!confirm('Remove this player?')) return
    await deletePlayer(id)
  }

  const handleApprove = async (p) => {
    await updatePlayer(p.id, { ...p, status: 'active' })
    // Open WhatsApp with the PIN if we have a phone number
    if (p.phone) {
      const phone   = p.phone.replace(/\D/g, '')
      const name    = (p.name || '').split(' ')[0]
      const pin     = p.pin || '????'
      const message = `Hi ${name}! 🦞 You've been approved for Padel Lobsters. Your access PIN is *${pin}* — enter it once in the app to confirm your identity. See you on the court!`
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank')
    }
  }

  const handleReject = async (id) => {
    if (!confirm('Reject and remove this registration request?')) return
    await deletePlayer(id)
  }

  // Admin links a pending new joiner to an existing player profile:
  // copies their contact info onto the existing player, deletes the pending entry, sends existing PIN
  const handleLinkConfirm = async (existingPlayer) => {
    const pending = linkModal
    if (!pending || !existingPlayer) return

    // Merge: fill in any missing fields on the existing player from the pending registration
    const merged = {
      name:               existingPlayer.name,
      email:              existingPlayer.email              || pending.email              || '',
      phone:              existingPlayer.phone              || pending.phone              || '',
      country:            existingPlayer.country            || pending.country            || '',
      gender:             existingPlayer.gender             || pending.gender             || '',
      playtomicLevel:     existingPlayer.playtomicLevel     || pending.playtomicLevel     || 0,
      adjustment:         existingPlayer.adjustment         ?? pending.adjustment         ?? 0,
      playtomicUsername:  existingPlayer.playtomicUsername  || pending.playtomicUsername  || '',
      isLeftHanded:       existingPlayer.isLeftHanded       || pending.isLeftHanded       || false,
      avatarUrl:          existingPlayer.avatarUrl          || pending.avatarUrl          || '',
      notes:              existingPlayer.notes              || pending.notes              || '',
      status:             'active',
    }
    await updatePlayer(existingPlayer.id, merged)
    await deletePlayer(pending.id)
    setLinkModal(null)
    setLinkSearch('')

    // Send existing player's PIN to the new joiner's phone
    const phone = (pending.phone || existingPlayer.phone || '').replace(/\D/g, '')
    const firstName = existingPlayer.name.trim().split(/\s+/)[0]
    if (phone && existingPlayer.pin) {
      const msg = `Hi ${firstName}! 🦞 Your profile has been linked. Your Padel Lobsters PIN is *${existingPlayer.pin}* — enter it once in the app to verify your identity. See you on court!`
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
    }
  }

  const handleRegeneratePin = async (p) => {
    const newPin = await regeneratePin(p.id)
    if (p.phone) {
      const phone   = p.phone.replace(/\D/g, '')
      const name    = (p.name || '').split(' ')[0]
      const message = `Hi ${name}! 🦞 Your Padel Lobsters PIN has been reset. New PIN: *${newPin}*`
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank')
    }
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Safety net: if a matching player exists and hasn't been merged yet, block submit
    if (!editId) {
      const typed = form.name.trim().toLowerCase()
      const duplicate = players.find(p => (p.name || '').trim().toLowerCase() === typed)
      if (duplicate) {
        // Force the merge banner to show — don't allow creating a duplicate
        setMergePlayer(duplicate)
        return
      }
    }

    // Validate all required fields before saving
    if (!isAdmin) {
      const missing = []
      if (!form.name.trim())          missing.push('Full Name')
      if (!form.country)              missing.push('Country')
      if (!form.gender)               missing.push('Gender')
      if (!form.email.trim())         missing.push('Email')
      if (!form.phone.trim())         missing.push('Phone / WhatsApp')
      if (!form.playtomicLevel)       missing.push('Playtomic Level')
      if (missing.length > 0) {
        alert(`Please complete the following fields before registering:\n\n• ${missing.join('\n• ')}`)
        return
      }
    }
    setSaving(true)
    try {
      let avatarUrl = form.avatarUrl || ''
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop()
        const filename = `player-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('avatars').upload(filename, avatarFile, { upsert: true })
        if (uploadError) {
          console.error('Avatar upload error:', uploadError)
          alert('Photo could not be saved: ' + uploadError.message + '\n\nMake sure the "avatars" storage bucket exists and is set to public in Supabase.')
        } else {
          const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filename)
          avatarUrl = publicUrl
        }
      }
      const isMerge = !!editId && !isAdmin
      const data = {
        ...form,
        avatarUrl,
        playtomicLevel: parseFloat(form.playtomicLevel) || 0,
        adjustment: parseFloat(form.adjustment) || 0,
        isLeftHanded: form.isLeftHanded || false,
        birthday: form.birthday || null,
        taglineLabel: lobbyPrompt.label,
        status: 'active',
      }
      const firstName = form.name.trim().split(/\s+/)[0]
      if (editId) {
        await updatePlayer(editId, data)
        if (!isAdmin) {
          const existing = players.find(p => String(p.id) === String(editId))
          if (existing?.pin) setPinReveal({ name: firstName, pin: existing.pin })
        }
      } else {
        const newPlayer = await addPlayer(data)
        if (newPlayer?.pin) {
          setPinReveal({ name: firstName, pin: newPlayer.pin })
        }
      }
      setShowForm(false)
      setAvatarFile(null); setAvatarPreview(null); setMergePlayer(null)
    } finally {
      setSaving(false)
    }
  }

  const levelBadge = (adjusted) => {
    const idx = Math.min(7, Math.max(0, Math.floor(adjusted || 0)))
    return LEVEL_COLORS[idx] || LEVEL_COLORS[0]
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">
          Players ({activePlayers.length})
          {pendingPlayers.length > 0 && isAdmin && (
            <span className="ml-2 text-xs bg-orange-100 text-orange-600 font-semibold px-2 py-0.5 rounded-full">
              {pendingPlayers.length} pending
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowAliasMatcher(true)}
              className="text-xs font-semibold text-lobster-teal border border-lobster-teal/30 bg-lobster-cream px-3 py-2 rounded-xl flex items-center gap-1.5 active:scale-95 transition-all"
              title="Tag historical names from past tournaments to current players"
            >
              <GitMerge size={14} /> Match history
            </button>
          )}
          <button onClick={openAdd} className="btn-primary py-2 px-4 text-sm flex items-center gap-1.5">
            <Plus size={16} /> Join
          </button>
        </div>
      </div>

      {/* Personalised-profile counter — only shown to admins so it doesn't
          clutter the public view. Helps gauge how many reviews are running
          on real data vs. the generic level-based fallback. */}
      {isAdmin && activePlayers.length > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] -mt-2 flex-wrap">
          <span className="bg-teal-50 text-teal-700 font-semibold px-2 py-0.5 rounded-full">
            ✦ {personalisedCount} personalised
          </span>
          <span className="bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full">
            {genericCount} generic
          </span>
          <span className="text-gray-400">
            {activePlayers.length > 0 ? Math.round((personalisedCount / activePlayers.length) * 100) : 0}% Lobster Reviews use real tournament data
          </span>
          <button
            onClick={() => setShowReviewBreakdown(true)}
            className="ml-auto text-lobster-teal font-semibold underline-offset-2 hover:underline"
          >
            View breakdown →
          </button>
        </div>
      )}

      {/* Admin-only Review Breakdown modal */}
      {showReviewBreakdown && (() => {
        const PERF_IDS = new Set(REVIEW_SCENARIOS.filter(s => s.performance).map(s => s.id))
        const perfBuckets  = reviewBreakdown.filter(b => PERF_IDS.has(b.id))
        const otherBuckets = reviewBreakdown.filter(b => !PERF_IDS.has(b.id))
        const perfPlayers  = perfBuckets.reduce((n, b) => n + b.players.length, 0)
        const perfFiring   = perfBuckets.length

        const renderBucket = (b, accent) => (
          <div
            key={b.id}
            className={`rounded-2xl border-2 px-3 py-3 ${
              accent === 'perf' ? 'bg-amber-50 border-amber-200' :
              accent === 'hist' ? 'bg-teal-50 border-teal-200' :
                                  'bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <p className={`text-xs font-bold ${
                accent === 'perf' ? 'text-amber-800' :
                accent === 'hist' ? 'text-teal-700' :
                                    'text-gray-500'
              }`}>
                {b.label}
              </p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                accent === 'perf' ? 'bg-amber-500 text-white' :
                accent === 'hist' ? 'bg-teal-500 text-white' :
                                    'bg-gray-200 text-gray-600'
              }`}>
                {b.players.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {b.players.map(p => (
                <span
                  key={p.id}
                  className="text-[11px] bg-white border border-gray-200 px-2 py-0.5 rounded-md text-gray-700"
                >
                  {(p.name || '').split(' ')[0]}
                </span>
              ))}
            </div>
            <div className="space-y-1.5">
              {[...b.samples.values()].map((s, i) => (
                <details key={i} className="text-[11px]">
                  <summary className="cursor-pointer text-gray-500 font-semibold">
                    {b.samples.size > 1 ? `Variant ${i + 1} (${s.count} player${s.count > 1 ? 's' : ''})` : 'Show message'}
                  </summary>
                  <p className="mt-1 italic text-gray-600 leading-relaxed">"{s.text}"</p>
                </details>
              ))}
            </div>
          </div>
        )

        return (
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center"
            onClick={() => setShowReviewBreakdown(false)}
          >
            <div
              className="bg-white rounded-t-3xl w-full max-w-md flex flex-col"
              style={{ maxHeight: '92vh' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-gray-800">Review breakdown</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Who's getting which Lobster Review, grouped by scenario
                  </p>
                </div>
                <button onClick={() => setShowReviewBreakdown(false)}>
                  <X size={20} className="text-gray-400" />
                </button>
              </div>

              {/* Performance summary banner */}
              <div className="px-5 py-3 bg-amber-50 border-b border-amber-100">
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-1">
                  ⭐ Performance messages
                </p>
                <p className="text-xs text-amber-700">
                  <strong>{perfFiring} of 10</strong> performance scenarios firing,
                  reaching <strong>{perfPlayers}</strong> player{perfPlayers === 1 ? '' : 's'}.
                  Everyone else gets historical, welcome, or generic level-based reviews.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {/* Performance scenarios first */}
                {perfBuckets.length > 0 && (
                  <div className="space-y-2">
                    {perfBuckets.map(b => renderBucket(b, 'perf'))}
                  </div>
                )}

                {/* Other scenarios (historical + filler) */}
                {otherBuckets.length > 0 && (
                  <>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-2 px-1">
                      Other scenarios
                    </p>
                    <div className="space-y-2">
                      {otherBuckets.map(b => {
                        const isHist = b.id.startsWith('hist-')
                        return renderBucket(b, isHist ? 'hist' : 'generic')
                      })}
                    </div>
                  </>
                )}

                {reviewBreakdown.length === 0 && (
                  <p className="text-center text-gray-400 text-sm py-10">No reviews to break down yet.</p>
                )}
              </div>

              <div className="px-5 py-3 border-t border-gray-100">
                <button onClick={() => setShowReviewBreakdown(false)} className="btn-primary w-full">Close</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Historical-name matcher (admin) */}
      {showAliasMatcher && (
        <PlayerAliasMatcher onClose={() => setShowAliasMatcher(false)} />
      )}

      {/* Pending approvals */}
      {isAdmin && pendingPlayers.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-orange-500" />
            <p className="text-sm font-bold text-orange-600">Waiting for approval ({pendingPlayers.length})</p>
          </div>
          {pendingPlayers.map(p => (
            <div key={p.id} className="card border-l-4 border-orange-300 space-y-2">
              <div className="flex items-center gap-3">
                <PlayerAvatar player={p} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{p.name}</p>
                  <p className="text-xs text-gray-500">
                    Lv {(p.adjustedLevel || 0).toFixed(1)}
                    {p.email && ` · ${p.email}`}
                  </p>
                </div>
                <button onClick={() => handleReject(p.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-50 active:scale-95 flex-shrink-0">
                  <X size={13} className="text-red-500" />
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleApprove(p)}
                  className="flex-1 text-xs bg-green-500 text-white px-3 py-2 rounded-xl font-semibold active:scale-95 transition-all">
                  ✓ Approve as new player
                </button>
                <button
                  onClick={() => { setLinkModal(p); setLinkSearch('') }}
                  className="flex-1 text-xs bg-lobster-teal text-white px-3 py-2 rounded-xl font-semibold active:scale-95 transition-all">
                  🔗 Played before?
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Link-to-existing modal */}
      {linkModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-md p-5 space-y-3 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-800">Link to existing player</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Who is <strong>{linkModal.name}</strong> in the system?
                </p>
              </div>
              <button onClick={() => { setLinkModal(null); setLinkSearch('') }}>
                <X size={22} className="text-gray-400" />
              </button>
            </div>

            <input
              type="text"
              placeholder="🔍 Search existing players…"
              value={linkSearch}
              onChange={e => setLinkSearch(e.target.value)}
              className="input"
              autoFocus
            />

            <div className="overflow-y-auto flex-1 space-y-2">
              {activePlayers
                .filter(p => p.name.toLowerCase().includes(linkSearch.toLowerCase()))
                .map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleLinkConfirm(p)}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl bg-gray-50 hover:bg-lobster-cream active:scale-[0.98] transition-all text-left"
                  >
                    <PlayerAvatar player={p} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-500">Lv {(p.adjustedLevel || 0).toFixed(1)}{p.email && ` · ${p.email}`}</p>
                    </div>
                  </button>
                ))}
            </div>

            <p className="text-xs text-gray-400 text-center pt-1">
              This will merge {linkModal.name}'s new contact info onto the existing profile and send them their PIN.
            </p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9" placeholder="Search players..." value={search}
          onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Player list */}
      <div className="space-y-2">
        {sorted.length === 0 && (
          <div className="card py-10 text-center text-gray-400">
            <User size={36} className="mx-auto mb-2 opacity-30" />
            <p>No players yet. Be the first to join!</p>
          </div>
        )}

        {sorted.map((p, idx) => {
          const expanded = expandedId === p.id
          return (
            <div key={p.id} ref={p.id === focusPlayerId ? focusRef : undefined} className="card transition-all">
              <div className="w-full" onClick={() => setExpandedId(expanded ? null : p.id)}>
                {/* Top row: rank · avatar · name · level · chevron */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-5 text-center flex-shrink-0">
                    #{idx + 1}
                  </span>
                  <PlayerAvatar player={p} />
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-semibold text-gray-800 truncate flex items-center gap-1.5">
                      {p.country && <FlagImg code={p.country} />}
                      {displayName(p)}
                      {p.isLeftHanded && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold ml-0.5">L</span>}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right flex flex-col items-end gap-1">
                    <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${levelBadge(p.adjustedLevel)}`}>
                      {(p.adjustedLevel || 0).toFixed(1)}
                    </span>
                    {isAdmin && p.pin && (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md tracking-wider">
                        {p.pin}
                      </span>
                    )}
                  </div>
                  {expanded
                    ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
                    : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
                </div>
                {/* Review — always visible */}
                <div className="mt-2 pl-8">
                  <p className="text-[10px] font-bold text-lobster-teal uppercase tracking-wider mb-0.5">Lobster Review</p>
                  {(() => {
                    const r = corpReview(p, matches, registrations, tournaments, playerAliases)
                    return (
                      <p className="text-xs text-gray-500 leading-relaxed">
                        {r.hasLabel && (
                          <span className="font-bold text-lobster-teal">{r.scenarioLabel}</span>
                        )}
                        {r.hasLabel ? ' — ' : ''}{r.body}
                      </p>
                    )
                  })()}
                </div>
              </div>

              {expanded && (() => {
                const stats = buildPlayerStats(
                  p.id, matches, tournaments, registrations,
                  players, playerAliases || {}, TOURNAMENTS
                )
                const topH2HPairs = Object.values(stats.h2hPairs)
                  .map(rec => ({
                    names: rec.ids.map(id => (players.find(pl => pl.id === id)?.name || '').split(' ')[0]).filter(Boolean),
                    ...rec,
                  }))
                  .filter(h => h.names.length > 0)
                  .sort((a, b) => (b.won + b.lost + b.draws) - (a.won + a.lost + a.draws))
                  .slice(0, 5)

                // 😈 Nemesis — opponent you've lost to at least once.
                // Tiebreaker: bigger deficit (losses − wins), then more losses.
                const nemesis = Object.entries(stats.h2h)
                  .filter(([, r]) => r.lost >= 1)
                  .map(([oppId, r]) => {
                    const opp = players.find(x => x.id === oppId)
                    return opp ? { name: opp.name.split(' ')[0], ...r } : null
                  })
                  .filter(Boolean)
                  .sort((a, b) => (b.lost - b.won) - (a.lost - a.won) || b.lost - a.lost)[0] || null

                // 🤝 Best partner — teammate you win the most with.
                // Show as soon as they've played together at least once; rank by wins then win-rate.
                const partnerRows = Object.entries(stats.partners)
                  .filter(([, r]) => r.games >= 1)
                  .map(([pid, r]) => {
                    const partner = players.find(x => x.id === pid)
                    return partner ? {
                      name: partner.name.split(' ')[0],
                      wins: r.wins, losses: r.losses, games: r.games,
                      winRate: r.games > 0 ? r.wins / r.games : 0,
                    } : null
                  })
                  .filter(Boolean)
                const bestPartner = [...partnerRows]
                  .filter(r => r.wins >= 1)
                  .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate)[0] || null
                // 🧊 Cooler — partner you've dropped matches with. Surfaces as soon as
                // there's been at least one shared loss.
                const worstPartner = [...partnerRows]
                  .filter(r => r.losses >= 1)
                  .sort((a, b) => b.losses - a.losses || a.winRate - b.winRate)[0] || null

                // Historical tournaments (Dec 2025 → Apr 2026, hardcoded in History.jsx).
                // Linked via the player_aliases table.
                const historical = buildHistoricalAppearances(p.id, playerAliases || {})
                const histSummary = summariseAppearances(historical)
                // Combined headline counts (DB tournaments + historical, deduped on id).
                const dbIds = new Set(stats.playerTournaments.map(t => t.id))
                const totalEvents = stats.playerTournaments.length +
                  historical.filter(h => !dbIds.has(h.id)).length

                return (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">

                  {/* Match record + tags row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {stats.played > 0 && (
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-lg font-semibold">
                        {stats.played} played · {stats.won}W {stats.lost}L{stats.draws > 0 ? ` ${stats.draws}D` : ''} · {stats.winRate}%
                      </span>
                    )}
                    {p.preferredPosition && (
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg font-semibold capitalize">
                        {p.preferredPosition === 'left' || p.preferredPosition === 'drive' ? '👈 Left' : p.preferredPosition === 'right' || p.preferredPosition === 'reves' ? '👉 Right' : '↔️ Both'}
                      </span>
                    )}
                    {p.isLeftHanded && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-lg font-semibold">🤚 Lefty</span>
                    )}
                    {p.birthday && (() => {
                      const [y, m, d] = p.birthday.split('-').map(Number)
                      const dt = new Date(y, m - 1, d)
                      const dayMonth = dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                      return <span className="text-xs text-gray-400">🎂 {dayMonth}</span>
                    })()}
                  </div>

                  {/* Level row — compact */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span>Playtomic {(p.playtomicLevel || 0).toFixed(1)}</span>
                    <span className={parseFloat(p.adjustment) >= 0 ? 'text-green-600' : 'text-red-500'}>
                      {parseFloat(p.adjustment) >= 0 ? '+' : ''}{p.adjustment || 0}
                    </span>
                    <span>→</span>
                    <span className={`font-bold px-1.5 py-0.5 rounded ${levelBadge(p.adjustedLevel)}`}>
                      {(p.adjustedLevel || 0).toFixed(1)}
                    </span>
                  </div>

                  {/* Recent form — last 5 matches */}
                  {stats.recentForm.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Last {stats.recentForm.length}</p>
                      <div className="flex gap-1">
                        {stats.recentForm.map((r, i) => (
                          <span key={i} className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                            r === 'W' ? 'bg-green-100 text-green-700' : r === 'L' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                          }`}>{r}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Detailed match metrics — game points, streaks, averages */}
                  {stats.played > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Match Metrics</p>
                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        <div className="bg-gray-50 rounded-lg px-2.5 py-1.5">
                          <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide block">Points for / against</span>
                          <span className="text-gray-700 font-bold">
                            {stats.pointsFor} – {stats.pointsAgainst}
                            <span className={`ml-1 font-normal ${stats.pointDiff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              ({stats.pointDiff >= 0 ? '+' : ''}{stats.pointDiff})
                            </span>
                          </span>
                        </div>
                        <div className="bg-gray-50 rounded-lg px-2.5 py-1.5">
                          <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide block">Avg per match</span>
                          <span className="text-gray-700 font-bold">
                            {stats.avgPointsFor.toFixed(1)} – {stats.avgPointsAgainst.toFixed(1)}
                          </span>
                        </div>
                        {stats.bestWinStreak > 0 && (
                          <div className="bg-gray-50 rounded-lg px-2.5 py-1.5">
                            <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide block">Best win streak</span>
                            <span className="text-green-700 font-bold">🔥 {stats.bestWinStreak}</span>
                          </div>
                        )}
                        {stats.worstLossStreak > 0 && (
                          <div className="bg-gray-50 rounded-lg px-2.5 py-1.5">
                            <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide block">Longest skid</span>
                            <span className="text-red-600 font-bold">🧊 {stats.worstLossStreak}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Nemesis + Best / Worst partner row */}
                  {(nemesis || bestPartner || worstPartner) && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Rivalries & Chemistry</p>
                      <div className="flex flex-col gap-1 text-xs">
                        {nemesis && (
                          <div className="flex items-center justify-between bg-red-50 rounded-lg px-2.5 py-1.5">
                            <span className="text-gray-700">😈 <span className="font-semibold">Nemesis</span> · {nemesis.name}</span>
                            <span className="font-semibold">
                              <span className="text-green-600">{nemesis.won}W</span>{' '}
                              <span className="text-red-500">{nemesis.lost}L</span>
                            </span>
                          </div>
                        )}
                        {bestPartner && (
                          <div className="flex items-center justify-between bg-green-50 rounded-lg px-2.5 py-1.5">
                            <span className="text-gray-700">🤝 <span className="font-semibold">Best partner</span> · {bestPartner.name}</span>
                            <span className="font-semibold text-green-700">
                              {bestPartner.wins}W / {bestPartner.games}
                            </span>
                          </div>
                        )}
                        {worstPartner && worstPartner.name !== bestPartner?.name && (
                          <div className="flex items-center justify-between bg-amber-50 rounded-lg px-2.5 py-1.5">
                            <span className="text-gray-700">💔 <span className="font-semibold">Jinx partner</span> · {worstPartner.name}</span>
                            <span className="font-semibold text-amber-700">
                              {worstPartner.wins}W / {worstPartner.games}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Head-to-head — top 5 opponent pairs */}
                  {topH2HPairs.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Head to Head</p>
                      <div className="space-y-1">
                        {topH2HPairs.map((h, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-gray-700 truncate max-w-[160px]">vs {h.names.join(' & ')}</span>
                            <span className="font-semibold">
                              <span className="text-green-600">{h.won}W</span>
                              {' '}<span className="text-red-500">{h.lost}L</span>
                              {h.draws > 0 && <> <span className="text-gray-400">{h.draws}D</span></>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tournament history — clickable */}
                  {stats.playerTournaments.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Tournaments</p>
                      <div className="flex flex-wrap gap-1.5">
                        {stats.playerTournaments.map(t => (
                          <button key={t.id}
                            onClick={(e) => { e.stopPropagation(); onNavigate && onNavigate('scores', t) }}
                            className="text-xs bg-lobster-cream text-lobster-teal px-2.5 py-1 rounded-lg font-semibold hover:bg-lobster-teal hover:text-white transition-all active:scale-95"
                          >
                            {t.name || new Date(t.date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Historical tournaments — derived from player_aliases + History.jsx */}
                  {historical.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          Tournament History
                        </p>
                        <p className="text-[10px] font-semibold text-gray-500">
                          {totalEvents} played
                          {histSummary.played > 0 && ` · ${histSummary.won}W ${histSummary.lost}L · ${histSummary.winRate}%`}
                        </p>
                      </div>

                      {/* Medal chips */}
                      {(histSummary.golds + histSummary.silvers + histSummary.bronzes) > 0 && (
                        <div className="flex gap-1.5 mb-2">
                          {histSummary.golds > 0 && (
                            <span className="text-[11px] bg-yellow-50 border border-yellow-200 text-yellow-700 px-2 py-0.5 rounded-lg font-bold">
                              🥇 ×{histSummary.golds}
                            </span>
                          )}
                          {histSummary.silvers > 0 && (
                            <span className="text-[11px] bg-gray-100 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-lg font-bold">
                              🥈 ×{histSummary.silvers}
                            </span>
                          )}
                          {histSummary.bronzes > 0 && (
                            <span className="text-[11px] border px-2 py-0.5 rounded-lg font-bold"
                                  style={{ background: 'rgba(205,127,50,0.10)', borderColor: 'rgba(205,127,50,0.3)', color: '#8B5E3C' }}>
                              🥉 ×{histSummary.bronzes}
                            </span>
                          )}
                          {histSummary.bestRank && histSummary.bestRank > 3 && (
                            <span className="text-[11px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded-lg font-semibold">
                              Best #{histSummary.bestRank}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Per-tournament rows */}
                      <div className="space-y-1">
                        {historical.map(h => {
                          const medal = h.rank === 1 ? '🥇' : h.rank === 2 ? '🥈' : h.rank === 3 ? '🥉' : `#${h.rank}`
                          return (
                            <div key={h.id} className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-2.5 py-1.5">
                              <span className="font-bold text-gray-600 w-7 text-center flex-shrink-0">{medal}</span>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-700 truncate">
                                  {h.name.replace('Lobster Tournament · ', '')}
                                </p>
                                <p className="text-[10px] text-gray-400">
                                  {h.date} · {h.played > 0 ? `${h.won}-${h.lost}${h.draws ? `-${h.draws}` : ''}` : `${h.players} players`}
                                </p>
                              </div>
                              <span className="text-xs font-bold text-lobster-teal flex-shrink-0">
                                {h.total} pts
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Hint when admin sees a player with no aliases linked yet */}
                  {isAdmin && historical.length === 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowAliasMatcher(true) }}
                      className="text-[11px] text-gray-400 hover:text-lobster-teal flex items-center gap-1 italic"
                    >
                      <GitMerge size={11} /> Link this player to past tournaments…
                    </button>
                  )}

                  {/* Admin info */}
                  {isAdmin && (p.email || p.phone) && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Admin only</p>
                      {p.email && <p className="text-xs text-gray-500">✉ {p.email}</p>}
                      {p.phone && <p className="text-xs text-gray-500">📞 {p.phone}</p>}
                    </div>
                  )}
                  {/* Player tagline / notes with saved prompt label */}
                  {(p.tagline || p.notes) && (
                    <div className="bg-lobster-cream rounded-xl px-3 py-2">
                      <p className="text-[10px] font-bold text-lobster-teal uppercase tracking-wider mb-0.5">
                        {p.taglineLabel || p.tagline_label || '💬 War Cry'}
                      </p>
                      <p className="text-xs text-gray-700 italic">"{p.tagline || p.notes}"</p>
                    </div>
                  )}

                  {/* PIN — admin only */}
                  {isAdmin && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-0.5">Access PIN</p>
                        <p className="text-xl font-bold text-amber-800 tracking-widest">{p.pin || '—'}</p>
                      </div>
                      <button
                        onClick={() => handleRegeneratePin(p)}
                        className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-xl font-semibold active:scale-95 transition-all"
                      >
                        Reset & send
                      </button>
                    </div>
                  )}

                  {isAdmin && (
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => openEdit(p)} className="btn-secondary flex-1 py-2 text-sm flex items-center justify-center gap-1">
                        <Pencil size={14} /> Edit
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="btn-danger flex-1 py-2 text-sm flex items-center justify-center gap-1">
                        <Trash2 size={14} /> Remove
                      </button>
                    </div>
                  )}
                </div>
                )
              })()}
            </div>
          )
        })}
      </div>

      {/* PIN reveal / pending confirmation modal */}
      {pinReveal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-5 text-center shadow-xl">
            <div className="text-5xl">🦞</div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Welcome, {pinReveal.name}!</h2>
              <p className="text-sm text-gray-500 mt-1">Here's your personal access PIN:</p>
            </div>

            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl py-5 px-4">
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-2">Your PIN</p>
              <p className="text-5xl font-bold text-amber-800 tracking-[0.35em]">{pinReveal.pin}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-left space-y-1.5">
              <p className="text-xs font-semibold text-gray-600">Save this PIN — you'll use it to:</p>
              <p className="text-xs text-gray-500">🦞 Post updates and react to messages</p>
              <p className="text-xs text-gray-500">📋 Confirm your identity in the app</p>
              <p className="text-xs text-gray-500">🔒 Keep your account secure</p>
            </div>
            <p className="text-[10px] text-gray-400">Ask the admin if you ever lose your PIN</p>

            <button onClick={() => setPinReveal(null)} className="btn-primary w-full">
              Got it, let's play! 🎾
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-md max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-800">{editId ? 'Edit Player' : 'Join the Lobsters 🦞'}</h2>
                {!editId && !isAdmin && (
                  <p className="text-xs text-gray-500 mt-0.5">You'll get an access PIN to use in the app</p>
                )}
              </div>
              <button onClick={() => { setShowForm(false); setAvatarFile(null); setAvatarPreview(null) }}>
                <X size={22} className="text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">

              {/* Avatar upload */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Preview"
                      className="w-20 h-20 rounded-full object-cover border-2 border-lobster-teal" />
                  ) : (
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300">
                      <User size={28} />
                    </div>
                  )}
                  <button type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 w-7 h-7 bg-lobster-teal rounded-full flex items-center justify-center text-white shadow-sm active:scale-95">
                    <Camera size={13} />
                  </button>
                </div>
                <p className="text-xs text-gray-400">Tap camera icon to add photo</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>

              <div>
                <label className="label">Full Name</label>
                <input required className="input" placeholder="e.g. Augustin Tapia" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              {/* Merge banner — shown for both admins and players when name already exists */}
              {mergePlayer && !editId && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🦞</span>
                    <div>
                      {isAdmin ? (
                        <>
                          <p className="font-semibold text-amber-800 text-sm">Player already exists!</p>
                          <p className="text-xs text-amber-700 mt-1">
                            <strong>{mergePlayer.name}</strong> is already in the system.
                            Update their existing profile instead of creating a duplicate?
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold text-amber-800 text-sm">Welcome back!</p>
                          <p className="text-xs text-amber-700 mt-1">
                            Your profile already exists — you've played in a past Lobster tournament.
                            Finish setting up your profile and we'll link everything together.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={acceptMerge}
                    className="w-full py-2.5 bg-amber-500 text-white rounded-xl font-semibold text-sm active:scale-95 transition-all">
                    {isAdmin ? `Update ${mergePlayer.name.split(' ')[0]}'s profile` : 'Yes, complete my profile'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMergePlayer(null)}
                    className="w-full py-2 text-amber-600 text-xs font-medium">
                    {isAdmin ? 'No, create as a new player' : "No, I'm a different person"}
                  </button>
                </div>
              )}

              <div>
                <label className="label">Country</label>
                <CountryPicker
                  value={form.country}
                  onChange={val => setForm(f => ({ ...f, country: val }))}
                />
              </div>

              {/* Gender — for optimal pair matching */}
              <div>
                <label className="label">Gender</label>
                <p className="text-xs text-gray-400 mb-2">For optimal pair matching</p>
                <div className="flex gap-3">
                  {[['male', 'Male'], ['female', 'Female']].map(([val, lbl]) => (
                    <button type="button" key={val}
                      onClick={() => setForm(f => ({ ...f, gender: f.gender === val ? '' : val }))}
                      className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                        form.gender === val ? 'bg-lobster-teal text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Left-handed */}
              <div>
                <label className="label">Playing hand</label>
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, isLeftHanded: !f.isLeftHanded }))}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all w-full justify-center ${
                    form.isLeftHanded
                      ? 'bg-amber-100 text-amber-700 border-2 border-amber-300'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                  🤚 {form.isLeftHanded ? 'Left-handed (tap to undo)' : 'Tap if left-handed'}
                </button>
              </div>

              {/* Preferred position */}
              <div>
                <label className="label">Preferred Side</label>
                <div className="flex gap-2">
                  {[['left', '👈 Left'], ['right', '👉 Right'], ['both', '↔️ Both']].map(([val, lbl]) => (
                    <button type="button" key={val}
                      onClick={() => setForm(f => ({ ...f, preferredPosition: f.preferredPosition === val ? '' : val }))}
                      className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-all ${
                        form.preferredPosition === val ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Playtomic Level</p>
                <div>
                  <label className="label">Playtomic Level (0–7)</label>
                  <input type="number" step="0.1" min="0" max="7" className="input" placeholder="e.g. 3.5"
                    value={form.playtomicLevel}
                    onChange={e => setForm(f => ({ ...f, playtomicLevel: e.target.value }))} />
                  <p className="text-xs text-gray-500 mt-1">Check your Playtomic app — it shows your current level</p>
                </div>
                <div>
                  <label className="label">Personal Adjustment</label>
                  <input type="number" step="0.1" min="-3" max="3" className="input" placeholder="0"
                    value={form.adjustment}
                    onChange={e => setForm(f => ({ ...f, adjustment: e.target.value }))} />
                  <p className="text-xs text-gray-500 mt-1">
                    Positive = stronger · Negative = weaker<br />
                    Adjusted Level = {((parseFloat(form.playtomicLevel) || 0) + (parseFloat(form.adjustment) || 0)).toFixed(1)}
                  </p>
                </div>
              </div>

              <div>
                <label className="label">Email</label>
                <input type="email" className="input" placeholder="player@email.com" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                <p className="text-xs text-gray-400 mt-1">Visible for organizers only</p>
              </div>

              <div>
                <label className="label">Phone / WhatsApp</label>
                <input type="tel" className="input" placeholder="+31 6 12345678" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                <p className="text-xs text-gray-400 mt-1">Visible for organizers only</p>
              </div>

              <div>
                <label className="label">Birthday 🎂</label>
                <input type="date" className="input" value={form.birthday || ''}
                  onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))} />
              </div>

              <div>
                <label className="label">{lobbyPrompt.label}</label>
                <textarea className="input resize-none" rows={2}
                  placeholder={lobbyPrompt.placeholder}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              <button type="submit" disabled={saving} className="btn-primary w-full">
                {saving ? 'Saving...' : editId ? 'Save Changes' : isAdmin ? 'Add Player' : 'Join the Lobsters 🦞'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
