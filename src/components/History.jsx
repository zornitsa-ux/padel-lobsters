import React, { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Check,
  ChevronDown,
  ChevronUp,
  Gamepad2,
  GitMerge,
  Pencil,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { supabase } from '../supabase'
import { TOURNAMENTS } from '../data/historicalTournaments'

// ── Name alias storage ────────────────────────────────────────────────────────
const ALIAS_KEY = 'lobster_name_aliases'
const SKIPPED_KEY = 'lobster_name_skipped' // pairs admin already said "different"

function loadAliases() {
  try {
    return JSON.parse(localStorage.getItem(ALIAS_KEY) || '{}')
  } catch {
    return {}
  }
}
function loadSkipped() {
  try {
    return JSON.parse(localStorage.getItem(SKIPPED_KEY) || '[]')
  } catch {
    return []
  }
}
function saveAliases(a) {
  localStorage.setItem(ALIAS_KEY, JSON.stringify(a))
}
function saveSkipped(s) {
  localStorage.setItem(SKIPPED_KEY, JSON.stringify(s))
}
function resolveName(name, aliases) {
  return aliases[name] || name
}

// ── Fuzzy name matching ───────────────────────────────────────────────────────
function normalize(n) {
  return n.toLowerCase().replace(/[\s.\-_]/g, '')
}

function editDistance(a, b) {
  const m = a.length,
    n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[m][n]
}

function areSimilar(a, b) {
  const na = normalize(a),
    nb = normalize(b)
  if (na === nb) return true
  if (na.startsWith(nb) || nb.startsWith(na)) return true
  if (na.includes(nb) || nb.includes(na)) return true
  // same first token (e.g. "Alex M" and "Alex G" → skip; "Gonzalo U" and "Gonzalo U" → match)
  const ta = a.toLowerCase().split(/\s+/),
    tb = b.toLowerCase().split(/\s+/)
  if (ta[0] === tb[0] && (ta.length === 1 || tb.length === 1)) return true
  const shorter = Math.min(na.length, nb.length)
  if (shorter >= 4 && editDistance(na, nb) <= Math.floor(shorter * 0.3)) return true
  return false
}

// Build clusters of similar names (Union-Find)
function buildSimilarGroups(names, aliases, skipped) {
  const canonical = names.map((n) => aliases[n] || n)
  const unique = [...new Set(canonical)]
  const parent = Object.fromEntries(unique.map((n) => [n, n]))

  const find = (n) => (parent[n] === n ? n : (parent[n] = find(parent[n])))
  const union = (a, b) => {
    parent[find(a)] = find(b)
  }

  const skippedSet = new Set(skipped.map(([a, b]) => `${a}|${b}`))
  const isPairSkipped = (a, b) => skippedSet.has(`${a}|${b}`) || skippedSet.has(`${b}|${a}`)

  for (let i = 0; i < unique.length; i++)
    for (let j = i + 1; j < unique.length; j++)
      if (!isPairSkipped(unique[i], unique[j]) && areSimilar(unique[i], unique[j]))
        union(unique[i], unique[j])

  const groups = {}
  unique.forEach((n) => {
    const root = find(n)
    if (!groups[root]) groups[root] = []
    groups[root].push(n)
  })

  return Object.values(groups)
    .filter((g) => g.length > 1)
    .sort((a, b) => b.length - a.length)
}

// ── Player journey builder ────────────────────────────────────────────────────
function buildPlayerJourney(canonicalName, aliases) {
  // reverse map: canonical → all raw names that resolve to it
  const rawNames = Object.entries(aliases)
    .filter(([, v]) => v === canonicalName)
    .map(([k]) => k)
  rawNames.push(canonicalName)
  const matches = new Set(rawNames.map(normalize))

  const appearances = []
  TOURNAMENTS.forEach((t) => {
    const inStandings = t.players?.find((p) => matches.has(normalize(p.name)))
    if (inStandings) {
      appearances.push({
        tournament: t.name.replace('Lobster Tournament · ', ''),
        pts: inStandings.total,
        rank: null,
      })
    }
  })
  // Compute ranks
  TOURNAMENTS.forEach((t, ti) => {
    const sorted = t.players ? [...t.players].sort((a, b) => b.total - a.total) : []
    sorted.forEach((p, idx) => {
      if (matches.has(normalize(p.name))) {
        const app = appearances.find(
          (a) => a.tournament === t.name.replace('Lobster Tournament · ', ''),
        )
        if (app) app.rank = idx + 1
      }
    })
  })
  return appearances
}

// ── Smart Match wizard ────────────────────────────────────────────────────────
function SmartMatchPanel({ onClose }) {
  const allNames = useMemo(getAllHardcodedNames, [])
  const [aliases, setAliasesState] = useState(loadAliases)
  const [skipped, setSkippedState] = useState(loadSkipped)
  const [step, setStep] = useState(0)
  const [checked, setChecked] = useState(null) // Set of checked names for current group
  const [input, setInput] = useState('')

  const groups = useMemo(
    () => buildSimilarGroups(allNames, aliases, skipped),
    [allNames, aliases, skipped],
  )

  const current = groups[step]

  // Initialise checkboxes when group changes — all checked by default
  const checkedSet = checked ?? new Set(current || [])

  const toggleCheck = (name) => {
    const next = new Set(checkedSet)
    next.has(name) ? next.delete(name) : next.add(name)
    setChecked(next)
  }

  // Which tournaments does a name appear in?
  const tournamentOf = (name) => {
    const norm = normalize(name)
    return TOURNAMENTS.filter(
      (t) =>
        t.players?.some((p) => normalize(p.name) === norm) ||
        t.rounds?.some((r) =>
          r.matches?.some(
            (m) =>
              m.t1?.some((n) => normalize(n) === norm) || m.t2?.some((n) => normalize(n) === norm),
          ),
        ),
    ).map((t) => t.name.replace('Lobster Tournament · ', ''))
  }

  const advance = (newAliases, newSkipped) => {
    saveAliases(newAliases)
    saveSkipped(newSkipped)
    setAliasesState(newAliases)
    setSkippedState(newSkipped)
    setChecked(null)
    setInput('')
    setStep((s) => s + 1)
  }

  const handleConfirm = () => {
    const toMerge = [...checkedSet]
    const toSkip = current.filter((n) => !checkedSet.has(n))
    const newAliases = { ...aliases }

    if (toMerge.length >= 2) {
      // Use input or first checked name as canonical
      const canonical = input.trim() || toMerge[0]
      toMerge.forEach((n) => {
        if (n !== canonical) newAliases[n] = canonical
      })
    }

    // Skip pairs between the two groups (merged vs unmerged) so they never re-appear
    const newPairs = []
    toMerge.forEach((a) => toSkip.forEach((b) => newPairs.push([a, b])))
    // Also skip pairs within unchecked names (they were shown and dismissed)
    for (let i = 0; i < toSkip.length; i++)
      for (let j = i + 1; j < toSkip.length; j++) newPairs.push([toSkip[i], toSkip[j]])

    advance(newAliases, [...skipped, ...newPairs])
  }

  const handleSkipAll = () => {
    // Mark every pair in this whole group as skipped
    const newPairs = []
    for (let i = 0; i < current.length; i++)
      for (let j = i + 1; j < current.length; j++) newPairs.push([current[i], current[j]])
    advance(aliases, [...skipped, ...newPairs])
  }

  const resetAll = () => {
    saveAliases({})
    saveSkipped([])
    setAliasesState({})
    setSkippedState([])
    setChecked(null)
    setStep(0)
  }

  const mergedCount = Object.keys(aliases).length

  if (!current) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
        <div className="bg-white rounded-t-3xl w-full max-w-md p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-800">Player Matching</h2>
            <button onClick={onClose}>
              <X size={20} className="text-gray-400" />
            </button>
          </div>
          <div className="text-center py-6 space-y-3">
            <div className="text-5xl">✅</div>
            <p className="font-bold text-gray-700">All done!</p>
            <p className="text-sm text-gray-400">
              {mergedCount > 0
                ? `${mergedCount} name${mergedCount !== 1 ? 's' : ''} merged across history.`
                : 'No similar names found to merge.'}
            </p>
          </div>
          <button onClick={resetAll} className="w-full text-xs text-gray-400 underline text-center">
            Reset all merges and start over
          </button>
          <button onClick={onClose} className="btn-primary w-full">
            Close
          </button>
        </div>
      </div>
    )
  }

  const progress = step / (step + groups.length)
  const checkedCount = checkedSet.size

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl w-full max-w-md flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold text-gray-800 flex items-center gap-2">
                <GitMerge size={18} className="text-lobster-teal" /> Match Players
              </h2>
              <p className="text-xs text-gray-400">Tick the names that belong to the same person</p>
            </div>
            <button onClick={onClose}>
              <X size={20} className="text-gray-400" />
            </button>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-lobster-teal rounded-full transition-all duration-500"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1 text-right">
            {step} reviewed · {groups.length} remaining
          </p>
        </div>

        {/* Name checklist */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {current.map((name) => {
            const tours = tournamentOf(name)
            const on = checkedSet.has(name)
            return (
              <button
                key={name}
                onClick={() => toggleCheck(name)}
                className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 transition-all text-left ${
                  on
                    ? 'bg-teal-50 border-2 border-lobster-teal'
                    : 'bg-gray-50 border-2 border-transparent'
                }`}
              >
                {/* Checkbox */}
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    on ? 'bg-lobster-teal border-lobster-teal' : 'border-gray-300'
                  }`}
                >
                  {on && <Check size={11} className="text-white" strokeWidth={3} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-sm ${on ? 'text-lobster-teal' : 'text-gray-800'}`}>
                    {name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {tours.length > 0 ? tours.join(' · ') : 'not in standings'}
                  </p>
                </div>
                <span className="text-lg shrink-0">
                  {tours.length >= 3 ? '🔥' : tours.length === 2 ? '⚡' : '🆕'}
                </span>
              </button>
            )
          })}

          {/* Canonical name input — only shown when ≥2 checked */}
          {checkedCount >= 2 && (
            <div className="pt-2 space-y-1.5">
              <p className="text-xs text-gray-500 font-semibold">
                Canonical name to use everywhere:
              </p>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={[...checkedSet][0]}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:border-lobster-teal"
              />
              <p className="text-[10px] text-gray-400">
                Leave blank to keep "{[...checkedSet][0]}"
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-gray-100 space-y-2">
          <button
            onClick={handleConfirm}
            disabled={checkedCount < 2}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Check size={16} />
            {checkedCount >= 2
              ? `Merge ${checkedCount} selected names`
              : 'Select at least 2 names to merge'}
          </button>
          <button
            onClick={handleSkipAll}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 active:scale-95 transition-all"
          >
            None are the same — skip all
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Calculate match wins and point differential for tiebreaking.
 * Analyzes rounds data to count wins per player and calculate point differential.
 */
function calculateStats(players, rounds) {
  const stats = {}
  players.forEach((p) => {
    stats[p.name] = { matchesWon: 0, pointsFor: 0, pointsAgainst: 0 }
  })

  rounds.forEach((round) => {
    round.matches?.forEach((match) => {
      // Determine which team won
      const team1Won = match.s1 > match.s2
      const team2Won = match.s2 > match.s1

      // Track points and wins
      match.t1?.forEach((name) => {
        if (stats[name]) {
          stats[name].pointsFor += match.s1
          stats[name].pointsAgainst += match.s2
          if (team1Won) stats[name].matchesWon += 1
        }
      })
      match.t2?.forEach((name) => {
        if (stats[name]) {
          stats[name].pointsFor += match.s2
          stats[name].pointsAgainst += match.s1
          if (team2Won) stats[name].matchesWon += 1
        }
      })
    })
  })

  return stats
}

/**
 * Smart ranking: Points → Matches Won → Differential → Alphabetical
 */
function smartSort(players, rounds) {
  const stats = calculateStats(players, rounds)
  return [...players].sort((a, b) => {
    // 1. By total points (descending)
    if (a.total !== b.total) return b.total - a.total

    // 2. By matches won (descending)
    const aWins = stats[a.name]?.matchesWon || 0
    const bWins = stats[b.name]?.matchesWon || 0
    if (aWins !== bWins) return bWins - aWins

    // 3. By points differential (descending)
    const aDiff = (stats[a.name]?.pointsFor || 0) - (stats[a.name]?.pointsAgainst || 0)
    const bDiff = (stats[b.name]?.pointsFor || 0) - (stats[b.name]?.pointsAgainst || 0)
    if (aDiff !== bDiff) return bDiff - aDiff

    // 4. Alphabetically (ascending)
    return a.name.localeCompare(b.name)
  })
}

function medalColor(pos) {
  if (pos === 0) return 'text-yellow-500'
  if (pos === 1) return 'text-gray-400'
  if (pos === 2) return '' // bronze via inline style
  return 'text-gray-400'
}
function medalStyleH(pos) {
  return pos === 2 ? { color: '#CD7F32' } : {}
}

// Build a {fullName: displayName} map.
// • If a first name is unique in the input, display = first name only.
// • If multiple players share a first name, append the rest of the name —
//   the original last token if it's already short (≤2 chars, e.g. "Alex M"),
//   otherwise just the last name's initial (e.g. "Daniel Net Hitter" → "Daniel N").
function buildDisplayNames(names) {
  const groups = {}
  ;(names || []).forEach((n) => {
    if (!n) return
    const f = n.trim().split(/\s+/)[0] || n
    if (!groups[f]) groups[f] = []
    groups[f].push(n)
  })
  const out = {}
  Object.entries(groups).forEach(([first, group]) => {
    const unique = [...new Set(group)]
    if (unique.length === 1) {
      unique.forEach((n) => {
        out[n] = first
      })
    } else {
      unique.forEach((n) => {
        const tokens = n.trim().split(/\s+/)
        const rest = tokens.slice(1).join(' ')
        if (!rest) {
          out[n] = n
          return
        }
        const tail = rest.length <= 2 ? rest : rest[0]
        out[n] = `${first} ${tail}`
      })
    }
  })
  return out
}

function Podium({ players, rounds = [], rn = (n) => n, dn = (n) => n }) {
  const sorted =
    rounds.length > 0 ? smartSort(players, rounds) : [...players].sort((a, b) => b.total - a.total)
  const top3 = sorted.slice(0, 3)
  if (top3.length < 2) return null
  return (
    <div className="flex items-end justify-center gap-2 py-2">
      {/* 2nd */}
      <div className="flex flex-col items-center gap-1 flex-1">
        <span className="text-xl">🥈</span>
        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600">
          {rn(top3[1]?.name || '')[0]}
        </div>
        <p className="text-sm font-semibold w-full text-center leading-tight px-1">
          {dn(rn(top3[1]?.name || ''))}
        </p>
        <div className="bg-gray-200 w-full h-10 rounded-t-xl flex items-center justify-center">
          <span className="text-xs font-bold text-gray-600">{top3[1]?.total}pts</span>
        </div>
      </div>
      {/* 1st */}
      <div className="flex flex-col items-center gap-1 flex-1">
        <span className="text-2xl">🥇</span>
        <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center font-bold text-white text-lg">
          {rn(top3[0]?.name || '')[0]}
        </div>
        <p className="text-base font-bold w-full text-center leading-tight px-1">
          {dn(rn(top3[0]?.name || ''))}
        </p>
        <div className="bg-yellow-400 w-full h-16 rounded-t-xl flex items-center justify-center">
          <span className="text-xs font-bold text-white">{top3[0]?.total}pts</span>
        </div>
      </div>
      {/* 3rd */}
      {top3[2] && (
        <div className="flex flex-col items-center gap-1 flex-1">
          <span className="text-xl">🥉</span>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white"
            style={{ background: '#CD7F32' }}
          >
            {rn(top3[2]?.name || '')[0]}
          </div>
          <p className="text-sm font-semibold w-full text-center leading-tight px-1">
            {dn(rn(top3[2]?.name || ''))}
          </p>
          <div
            className="w-full h-7 rounded-t-xl flex items-center justify-center"
            style={{ background: '#CD7F32' }}
          >
            <span className="text-xs font-bold text-white">{top3[2]?.total}pts</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Collect all unique hardcoded names ───────────────────────────────────────
function getAllHardcodedNames() {
  const names = new Set()
  TOURNAMENTS.forEach((t) => {
    t.players?.forEach((p) => names.add(p.name))
    t.rounds?.forEach((r) =>
      r.matches?.forEach((m) => {
        m.t1?.forEach((n) => names.add(n))
        m.t2?.forEach((n) => names.add(n))
      }),
    )
  })
  return [...names].sort((a, b) => a.localeCompare(b))
}

// ── Main component ────────────────────────────────────────────────────────────
export default function History({ onNavigate }) {
  const { tournaments, players, getTournamentMatches, getTournamentRegistrations, session } =
    useApp()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const [expandedId, setExpandedId] = useState(null)
  const [activeTab, setActiveTab] = useState({}) // id → 'standings' | 'matches' | 'games'
  const [activeRound, setActiveRound] = useState({}) // id → roundIndex
  const [dbActiveTab, setDbActiveTab] = useState({}) // dbId → 'standings' | 'matches' | 'games'
  const [dbActiveRound, setDbActiveRound] = useState({}) // dbId → roundIndex
  const [dbGameResults, setDbGameResults] = useState({}) // tId → array
  const [aliases] = useState(loadAliases)
  const rn = useCallback((name) => resolveName(name, aliases), [aliases])

  const getTab = (id) => activeTab[id] || 'standings'
  const getRound = (id) => activeRound[id] ?? 0
  const getDbTab = (id) => dbActiveTab[id] || 'standings'
  const getDbRound = (id) => dbActiveRound[id] ?? 0

  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000

  // Completed tournaments from DB older than 2 days after tournament date
  const dynamicTournaments = useMemo(() => {
    return tournaments
      .filter((t) => {
        if (t.status !== 'completed') return false
        const refDate = t.date || t.completedAt
        if (!refDate) return true
        return Date.now() - new Date(refDate).getTime() >= TWO_DAYS_MS
      })
      .sort((a, b) => ((b.date || b.completedAt || '') > (a.date || a.completedAt || '') ? 1 : -1))
  }, [tournaments])

  // Global first-name disambiguation map across the entire player base.
  // "Gonzalo" stays "Gonzalo" if unique; "Gonzalo U" / "Gonzalo E" if not.
  // Built once and reused by every tournament card so names don't flip
  // between cards depending on local roster.
  const globalDnMap = useMemo(() => {
    const names = new Set()
    players.forEach((p) => {
      if (p?.name) names.add(p.name)
    })
    // Include any hardcoded-tournament names that may not exist in players,
    // resolved through aliases first.
    TOURNAMENTS.forEach((t) => {
      t.players?.forEach((p) => {
        const r = rn(p.name)
        if (r) names.add(r)
      })
      t.rounds?.forEach((r) =>
        r.matches?.forEach((mm) => {
          mm.t1?.forEach((n) => {
            const x = rn(n)
            if (x) names.add(x)
          })
          mm.t2?.forEach((n) => {
            const x = rn(n)
            if (x) names.add(x)
          })
        }),
      )
    })
    return buildDisplayNames([...names])
  }, [players, rn])
  const globalDn = useCallback(
    (n) => globalDnMap[n] || (n || '').split(' ')[0] || '',
    [globalDnMap],
  )

  // Fetch shared Lobster Oscars results for any completed dynamic tournament
  // that doesn't have them cached yet — used by the "Lobster games" tab on
  // those event cards. Returns empty until the admin pressed Share for that
  // tournament's session (share gate enforced server-side).
  useEffect(() => {
    let active = true
    dynamicTournaments.forEach((t) => {
      if (dbGameResults[t.id] !== undefined) return
      ;(async () => {
        const { data } = await supabase.rpc('lobster_oscars_get_results', {
          input_tournament_id: t.id,
        })
        if (active) {
          setDbGameResults((prev) => ({ ...prev, [t.id]: data || [] }))
        }
      })()
    })
    return () => {
      active = false
    }
  }, [dynamicTournaments, dbGameResults])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">Tournament History</h2>
      </div>

      {/* Dynamic tournaments from DB */}
      {dynamicTournaments.map((t) => {
        const open = expandedId === `db-${t.id}`
        const tMatches = getTournamentMatches(t.id)
        const tRegs = getTournamentRegistrations(t.id).filter((r) => r.status === 'registered')

        // Compute standings
        const stats = {}
        tRegs.forEach((r) => {
          const p = players.find((x) => x.id === r.playerId)
          if (p) stats[r.playerId] = { player: p, played: 0, won: 0, lost: 0, pf: 0, pa: 0, pts: 0 }
        })
        tMatches
          .filter((m) => m.completed && m.score1 != null)
          .forEach((m) => {
            const s1 = m.score1,
              s2 = m.score2
            const t1w = s1 > s2,
              t2w = s2 > s1
            ;(m.team1Ids || []).forEach((id) => {
              if (!stats[id]) return
              stats[id].played++
              stats[id].pf += s1
              stats[id].pa += s2
              stats[id].pts += s1
              if (t1w) stats[id].won++
              else if (t2w) stats[id].lost++
            })
            ;(m.team2Ids || []).forEach((id) => {
              if (!stats[id]) return
              stats[id].played++
              stats[id].pf += s2
              stats[id].pa += s1
              stats[id].pts += s2
              if (t2w) stats[id].won++
              else if (t1w) stats[id].lost++
            })
          })
        const rankings = Object.values(stats).sort((a, b) =>
          b.pts !== a.pts
            ? b.pts - a.pts
            : b.won !== a.won
              ? b.won - a.won
              : b.pf - b.pa - (a.pf - a.pa),
        )
        const top3 = rankings.slice(0, 3)

        // Derive category pill from gender mode + registered roster
        const tCategory = (() => {
          if (t.genderMode === 'mixed') return 'mixed'
          if (t.genderMode === 'same_gender') {
            const genders = new Set(
              tRegs.map((r) => players.find((x) => x.id === r.playerId)?.gender).filter(Boolean),
            )
            if (genders.size === 1 && genders.has('female')) return 'ladies'
            if (genders.size === 1 && genders.has('male')) return 'mens'
            return 'same'
          }
          return null
        })()

        return (
          <div key={`db-${t.id}`} className="card overflow-hidden border-l-4 border-yellow-400">
            <button
              className="w-full flex items-center justify-between gap-3"
              onClick={() => setExpandedId(open ? null : `db-${t.id}`)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Trophy size={20} className="text-yellow-500" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-800 text-sm flex items-center gap-1.5 flex-wrap">
                    <span>{t.name}</span>
                    {tCategory === 'ladies' && (
                      <span className="text-[10px] font-bold bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded-full">
                        Ladies
                      </span>
                    )}
                    {tCategory === 'mens' && (
                      <span className="text-[10px] font-bold bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">
                        Mens
                      </span>
                    )}
                    {tCategory === 'mixed' && (
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
                        Mixed
                      </span>
                    )}
                    {tCategory === 'same' && (
                      <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                        Same Gender
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t.date
                      ? new Date(t.date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : '—'}
                    {tRegs.length > 0 ? ` · ${tRegs.length} players` : ''}
                  </p>
                </div>
              </div>
              {open ? (
                <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
              )}
            </button>

            {open &&
              (() => {
                const dbTab = getDbTab(t.id)
                const dbRi = getDbRound(t.id)
                const playerNameById = (id) => players.find((p) => p.id === id)?.name || '?'
                // Use the global display-name map so names render consistently
                // across all event cards, regardless of who's in this roster.
                const dbDn = globalDn
                const dbDnId = (id) => globalDn(playerNameById(id))

                // Group completed matches by round, sort within round by court number.
                const courtNum = (label) => {
                  const mm = String(label ?? '').match(/(\d+)/)
                  return mm ? parseInt(mm[1], 10) : Number.MAX_SAFE_INTEGER
                }
                const byRound = {}
                tMatches.forEach((mt) => {
                  const r = mt.round || 1
                  if (!byRound[r]) byRound[r] = []
                  byRound[r].push(mt)
                })
                Object.values(byRound).forEach((arr) =>
                  arr.sort((a, b) => courtNum(a.court) - courtNum(b.court)),
                )
                const dbRounds = Object.keys(byRound)
                  .map(Number)
                  .sort((a, b) => a - b)
                  .map((n) => ({ round: n, matches: byRound[n] }))

                const gameResults = dbGameResults[t.id] || []
                const hasGameResults = gameResults.length > 0
                const hasMatches = tMatches.length > 0

                return (
                  <div className="mt-4 space-y-3">
                    {/* Podium */}
                    {top3.length >= 2 && (
                      <div className="flex items-end justify-center gap-2 py-2">
                        <div className="flex flex-col items-center gap-1 flex-1">
                          <span className="text-xl">🥈</span>
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600">
                            {top3[1].player.name[0]}
                          </div>
                          <p className="text-sm font-semibold w-full text-center leading-tight px-1">
                            {dbDn(top3[1].player.name)}
                          </p>
                          <div className="bg-gray-200 w-full h-10 rounded-t-xl flex items-center justify-center">
                            <span className="text-xs font-bold text-gray-600">
                              {top3[1].pts}pts
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-1 flex-1">
                          <span className="text-2xl">🥇</span>
                          <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center font-bold text-white text-lg">
                            {top3[0].player.name[0]}
                          </div>
                          <p className="text-base font-bold w-full text-center leading-tight px-1">
                            {dbDn(top3[0].player.name)}
                          </p>
                          <div className="bg-yellow-400 w-full h-16 rounded-t-xl flex items-center justify-center">
                            <span className="text-xs font-bold text-white">{top3[0].pts}pts</span>
                          </div>
                        </div>
                        {top3[2] && (
                          <div className="flex flex-col items-center gap-1 flex-1">
                            <span className="text-xl">🥉</span>
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white"
                              style={{ background: '#CD7F32' }}
                            >
                              {top3[2].player.name[0]}
                            </div>
                            <p className="text-sm font-semibold w-full text-center leading-tight px-1">
                              {dbDn(top3[2].player.name)}
                            </p>
                            <div
                              className="w-full h-7 rounded-t-xl flex items-center justify-center"
                              style={{ background: '#CD7F32' }}
                            >
                              <span className="text-xs font-bold text-white">{top3[2].pts}pts</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tabs — Full Standings | Match Results | Lobster Games (conditional) */}
                    <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
                      <button
                        onClick={() => setDbActiveTab((s) => ({ ...s, [t.id]: 'standings' }))}
                        className={`flex-1 min-w-max py-1.5 px-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                          dbTab === 'standings'
                            ? 'bg-white text-lobster-teal shadow-sm'
                            : 'text-gray-500'
                        }`}
                      >
                        Full Standings
                      </button>
                      {hasMatches && (
                        <button
                          onClick={() => setDbActiveTab((s) => ({ ...s, [t.id]: 'matches' }))}
                          className={`flex-1 min-w-max py-1.5 px-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                            dbTab === 'matches'
                              ? 'bg-white text-lobster-teal shadow-sm'
                              : 'text-gray-500'
                          }`}
                        >
                          Match Results
                        </button>
                      )}
                      {hasGameResults && (
                        <button
                          onClick={() => setDbActiveTab((s) => ({ ...s, [t.id]: 'games' }))}
                          className={`flex-1 min-w-max py-1.5 px-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                            dbTab === 'games'
                              ? 'bg-white text-lobster-teal shadow-sm'
                              : 'text-gray-500'
                          }`}
                        >
                          🦞 Lobster Games
                        </button>
                      )}
                    </div>

                    {/* ── Full Standings ── */}
                    {dbTab === 'standings' && rankings.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-400 uppercase border-b border-gray-100">
                              <th className="text-left pb-1.5 pl-1">#</th>
                              <th className="text-left pb-1.5">Player</th>
                              <th className="text-center pb-1.5">W</th>
                              <th className="text-center pb-1.5">L</th>
                              <th className="text-center pb-1.5">+/-</th>
                              <th className="text-center pb-1.5 text-gray-600 font-bold">Pts</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rankings.map((s, i) => (
                              <tr key={s.player.id} className="border-b border-gray-50">
                                <td className="py-1.5 pl-1 text-gray-400 font-bold">{i + 1}</td>
                                <td className="py-1.5 font-medium text-sm">
                                  {dbDn(s.player.name)}
                                </td>
                                <td className="text-center py-1.5 text-green-600 font-semibold">
                                  {s.won}
                                </td>
                                <td className="text-center py-1.5 text-red-400">{s.lost}</td>
                                <td className="text-center py-1.5 text-gray-400">
                                  {s.pf}-{s.pa}
                                </td>
                                <td className="text-center py-1.5 font-bold text-lobster-teal">
                                  {s.pts}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {dbTab === 'standings' && rankings.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-2">
                        No match data available
                      </p>
                    )}

                    {/* ── Match Results ── */}
                    {dbTab === 'matches' && hasMatches && (
                      <div>
                        <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3">
                          {dbRounds.map((r, i) => (
                            <button
                              key={r.round}
                              onClick={() => setDbActiveRound((s) => ({ ...s, [t.id]: i }))}
                              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                                dbRi === i
                                  ? 'bg-lobster-teal text-white'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              R{r.round}
                            </button>
                          ))}
                        </div>

                        <div className="space-y-2">
                          {dbRounds[dbRi]?.matches.map((mt) => {
                            const s1 = mt.score1,
                              s2 = mt.score2
                            const scored = mt.completed && s1 != null && s2 != null
                            const t1won = scored && s1 > s2
                            const t2won = scored && s2 > s1
                            const t1Names = (mt.team1Ids || []).map(dbDnId)
                            const t2Names = (mt.team2Ids || []).map(dbDnId)
                            return (
                              <div key={mt.id} className="bg-gray-50 rounded-xl p-3">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[10px] font-bold text-lobster-teal bg-lobster-cream px-2 py-0.5 rounded-full">
                                    {mt.court || `Round ${mt.round}`}
                                  </span>
                                  {scored && s1 === s2 && (
                                    <span className="text-[10px] text-gray-400 font-medium">
                                      Draw
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`flex-1 min-w-0 ${t1won ? 'text-green-700' : 'text-gray-600'}`}
                                  >
                                    {t1Names.map((name, i) => (
                                      <p key={i} className="text-sm font-semibold leading-tight">
                                        {name}
                                      </p>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <span
                                      className={`text-lg font-bold w-7 text-center ${t1won ? 'text-green-600' : 'text-gray-400'}`}
                                    >
                                      {scored ? s1 : '—'}
                                    </span>
                                    <span className="text-gray-300 text-sm">–</span>
                                    <span
                                      className={`text-lg font-bold w-7 text-center ${t2won ? 'text-green-600' : 'text-gray-400'}`}
                                    >
                                      {scored ? s2 : '—'}
                                    </span>
                                  </div>
                                  <div
                                    className={`flex-1 min-w-0 text-right ${t2won ? 'text-green-700' : 'text-gray-600'}`}
                                  >
                                    {t2Names.map((name, i) => (
                                      <p key={i} className="text-sm font-semibold leading-tight">
                                        {name}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── Lobster Games ── */}
                    {dbTab === 'games' &&
                      hasGameResults &&
                      (() => {
                        const byCat = new Map()
                        for (const r of gameResults) {
                          if (!byCat.has(r.category_id))
                            byCat.set(r.category_id, {
                              id: r.category_id,
                              name: r.category_name,
                              icon: r.category_icon,
                              display_order: r.display_order,
                              rows: [],
                            })
                          byCat.get(r.category_id).rows.push(r)
                        }
                        const cats = Array.from(byCat.values()).sort(
                          (a, b) => (a.display_order || 0) - (b.display_order || 0),
                        )
                        return (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 px-1">
                              <Gamepad2 size={14} className="text-lobster-teal" />
                              <p className="text-xs font-bold text-gray-700">🏆 Lobster Oscars</p>
                              <span className="text-[10px] text-gray-400 ml-auto">
                                {cats.length} categor{cats.length === 1 ? 'y' : 'ies'}
                              </span>
                            </div>
                            {cats.map((cat) => {
                              const winners = cat.rows.filter(
                                (r) => Number(r.rank_in_category) === 1,
                              )
                              const maxV = Math.max(
                                1,
                                ...cat.rows.map((r) => Number(r.votes_count)),
                              )
                              const topVotes = winners.length ? Number(winners[0].votes_count) : 0
                              return (
                                <div
                                  key={cat.id}
                                  className="bg-white rounded-xl p-3 space-y-1.5 border border-gray-100"
                                >
                                  <p className="font-bold text-xs text-gray-700">
                                    <span className="mr-1">{cat.icon}</span>
                                    {cat.name}
                                  </p>
                                  {winners.length > 0 ? (
                                    <p className="text-xs text-gray-600">
                                      🏆{' '}
                                      <span className="font-bold">
                                        {winners.map((w) => w.target_name).join(', ')}
                                      </span>{' '}
                                      <span className="text-gray-400">
                                        ({topVotes} vote{topVotes !== 1 ? 's' : ''}
                                        {winners.length > 1 ? ' — tie' : ''})
                                      </span>
                                    </p>
                                  ) : (
                                    <p className="text-[10px] text-gray-400">No votes</p>
                                  )}
                                  <div className="space-y-0.5">
                                    {cat.rows.map((r) => (
                                      <div key={r.target_id} className="flex items-center gap-2">
                                        <span className="text-[10px] w-16 truncate text-gray-600">
                                          {(r.target_name || '').split(' ')[0]}
                                        </span>
                                        <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                          <div
                                            className="h-full bg-lobster-teal rounded-full transition-all"
                                            style={{
                                              width: `${(Number(r.votes_count) / maxV) * 100}%`,
                                            }}
                                          />
                                        </div>
                                        <span className="text-[10px] text-gray-500 w-3 text-right">
                                          {Number(r.votes_count)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })()}

                    {onNavigate && (
                      <button
                        onClick={() => onNavigate('scores', t)}
                        className="w-full text-xs text-lobster-teal font-semibold border border-lobster-teal rounded-xl py-2 active:scale-95 transition-all"
                      >
                        View full match scores →
                      </button>
                    )}
                  </div>
                )
              })()}
          </div>
        )
      })}

      {/* Hardcoded past tournaments */}
      {TOURNAMENTS.map((t) => {
        const open = expandedId === t.id
        const tab = getTab(t.id)
        const ri = getRound(t.id)
        const sorted = t.players ? smartSort(t.players, t.rounds || []) : []
        // Use the global display-name map so first-name collisions are
        // disambiguated consistently across every event card.
        const dn = (n) => globalDn(rn(n))

        return (
          <div key={t.id} className="card overflow-hidden border-l-4 border-yellow-400">
            {/* Card header */}
            <button
              className="w-full flex items-center justify-between gap-3"
              onClick={() => setExpandedId(open ? null : t.id)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Trophy size={20} className="text-yellow-500" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                    {t.name}
                    {t.type === 'ladies' && (
                      <span className="text-[10px] font-bold bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded-full">
                        Ladies
                      </span>
                    )}
                    {t.type === 'mixed' && (
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
                        Mixed
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t.date
                      ? new Date(t.date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })
                      : ''}
                    {t.players ? `${t.date ? ' · ' : ''}${t.players.length} players` : '—'}
                    {t.numRounds ? ` · ${t.numRounds} rounds` : ''}
                    {t.numCourts ? ` · ${t.numCourts} courts` : ''}
                  </p>
                </div>
              </div>
              {open ? (
                <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
              )}
            </button>

            {open && (
              <div className="mt-4">
                {/* Podium */}
                {sorted.length > 0 && (
                  <Podium players={sorted} rounds={t.rounds || []} rn={rn} dn={dn} />
                )}

                {/* Tabs */}
                <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-3">
                  <button
                    onClick={() => setActiveTab((s) => ({ ...s, [t.id]: 'standings' }))}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      tab === 'standings' ? 'bg-white text-lobster-teal shadow-sm' : 'text-gray-500'
                    }`}
                  >
                    Full Standings
                  </button>
                  {t.rounds && (
                    <button
                      onClick={() => setActiveTab((s) => ({ ...s, [t.id]: 'matches' }))}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        tab === 'matches' ? 'bg-white text-lobster-teal shadow-sm' : 'text-gray-500'
                      }`}
                    >
                      Match Results
                    </button>
                  )}
                </div>

                {/* Note (when no pairings available) */}
                {tab === 'standings' && t.note && (
                  <p className="text-xs text-gray-400 italic mb-3 px-1">{t.note}</p>
                )}

                {/* ── Standings tab ── */}
                {tab === 'standings' && sorted.length > 0 && (
                  <div className="space-y-1">
                    {/* Column headers */}
                    <div
                      className="grid text-[10px] font-bold text-gray-400 uppercase px-2 mb-1"
                      style={{
                        gridTemplateColumns:
                          t.id === 'jan2026'
                            ? '28px 1fr 28px 28px 28px 28px 28px 28px 36px'
                            : '28px 1fr 44px',
                      }}
                    >
                      <span>#</span>
                      <span>Player</span>
                      {t.id === 'jan2026' ? (
                        <>
                          <span className="text-center">R1</span>
                          <span className="text-center">R2</span>
                          <span className="text-center">R3</span>
                          <span className="text-center">R4</span>
                          <span className="text-center">R5</span>
                          <span className="text-center">R6</span>
                          <span className="text-right">Tot</span>
                        </>
                      ) : (
                        <span className="text-right">Total</span>
                      )}
                    </div>

                    {sorted.map((p, idx) => (
                      <div
                        key={p.name}
                        className={`grid items-center px-2 py-1.5 rounded-xl text-sm ${
                          idx === 0
                            ? 'bg-yellow-50 border border-yellow-200'
                            : idx === 1
                              ? 'bg-gray-50'
                              : idx === 2
                                ? ''
                                : ''
                        }`}
                        style={{
                          gridTemplateColumns:
                            t.id === 'jan2026'
                              ? '28px 1fr 28px 28px 28px 28px 28px 28px 36px'
                              : '28px 1fr 44px',
                          ...(idx === 2 ? { background: 'rgba(205,127,50,0.1)' } : {}),
                        }}
                      >
                        <span
                          className={`text-xs font-bold ${medalColor(idx)}`}
                          style={medalStyleH(idx)}
                        >
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                        </span>
                        <span
                          className={`font-medium text-sm leading-tight ${idx < 3 ? 'font-bold' : ''}`}
                        >
                          {dn(p.name)}
                        </span>
                        {p.r ? (
                          <>
                            {p.r.map((score, ri) => (
                              <span key={ri} className="text-center text-xs text-gray-600">
                                {score}
                              </span>
                            ))}
                            <span className="text-right font-bold text-lobster-teal text-xs">
                              {p.total}
                            </span>
                          </>
                        ) : (
                          <span className="text-right font-bold text-lobster-teal text-xs">
                            {p.total}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Matches tab ── */}
                {tab === 'matches' && t.rounds && (
                  <div>
                    {/* Round selector */}
                    <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3">
                      {t.rounds.map((r, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveRound((s) => ({ ...s, [t.id]: i }))}
                          className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            ri === i ? 'bg-lobster-teal text-white' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          R{r.round}
                        </button>
                      ))}
                    </div>

                    {/* Match cards for selected round */}
                    <div className="space-y-2">
                      {t.rounds[ri]?.matches.map((m, i) => {
                        const t1won = m.s1 > m.s2
                        const t2won = m.s2 > m.s1
                        return (
                          <div key={i} className="bg-gray-50 rounded-xl p-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] font-bold text-lobster-teal bg-lobster-cream px-2 py-0.5 rounded-full">
                                Court {m.court}
                              </span>
                              {m.s1 === m.s2 && (
                                <span className="text-[10px] text-gray-400 font-medium">Draw</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Team A */}
                              <div
                                className={`flex-1 min-w-0 ${t1won ? 'text-green-700' : 'text-gray-600'}`}
                              >
                                {m.t1.map((name) => (
                                  <p key={name} className="text-sm font-semibold leading-tight">
                                    {dn(name)}
                                  </p>
                                ))}
                              </div>
                              {/* Score */}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <span
                                  className={`text-lg font-bold w-7 text-center ${t1won ? 'text-green-600' : 'text-gray-400'}`}
                                >
                                  {m.s1}
                                </span>
                                <span className="text-gray-300 text-sm">–</span>
                                <span
                                  className={`text-lg font-bold w-7 text-center ${t2won ? 'text-green-600' : 'text-gray-400'}`}
                                >
                                  {m.s2}
                                </span>
                              </div>
                              {/* Team B */}
                              <div
                                className={`flex-1 min-w-0 text-right ${t2won ? 'text-green-700' : 'text-gray-600'}`}
                              >
                                {m.t2.map((name) => (
                                  <p key={name} className="text-sm font-semibold leading-tight">
                                    {dn(name)}
                                  </p>
                                ))}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
