import { TOURNAMENTS } from '../../data/historicalTournaments'
import { normalize, areSimilar } from './fuzzyMatch'

// Build clusters of similar names (Union-Find)
export function buildSimilarGroups(names, aliases, skipped) {
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
export function buildPlayerJourney(canonicalName, aliases) {
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
