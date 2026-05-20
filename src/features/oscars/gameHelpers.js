/* ─── Match-history helper: rounds where voter played WITH or AGAINST target  */
export function computeHistory(voterId, targetId, matches) {
  if (!voterId || !targetId || !matches?.length) return []
  const lines = []
  for (const m of matches) {
    const t1 = (m.team1_ids || []).map(String)
    const t2 = (m.team2_ids || []).map(String)
    const voterOnT1 = t1.includes(String(voterId))
    const voterOnT2 = t2.includes(String(voterId))
    const targetOnT1 = t1.includes(String(targetId))
    const targetOnT2 = t2.includes(String(targetId))
    if (!(voterOnT1 || voterOnT2) || !(targetOnT1 || targetOnT2)) continue
    if ((voterOnT1 && targetOnT1) || (voterOnT2 && targetOnT2)) {
      lines.push({ round: m.round, type: 'with' })
    } else {
      const targetTeam = targetOnT1 ? t1 : t2
      const partnerId = targetTeam.find((id) => id !== String(targetId))
      lines.push({ round: m.round, type: 'vs', partnerId })
    }
  }
  return lines.sort((a, b) => a.round - b.round)
}

/* Letter avatar color now lives in src/lib/letterColors.js — single source of truth. */

/* ─── First-name with disambiguation (unchanged from v1) ──────────────────── */
export function shortLabelMap(players = []) {
  const firstOf = (p) => (p.name || '').trim().split(/\s+/)[0] || p.name || ''
  const lastOf = (p) => {
    const parts = (p.name || '').trim().split(/\s+/)
    return parts.length > 1 ? parts.slice(1).join(' ') : ''
  }
  const byFirst = {}
  players.forEach((p) => {
    const f = firstOf(p).toLowerCase()
    ;(byFirst[f] ??= []).push(p)
  })
  const out = {}
  for (const key in byFirst) {
    const group = byFirst[key]
    if (group.length === 1) {
      out[String(group[0].id)] = firstOf(group[0])
      continue
    }
    group.sort((a, b) => String(a.id).localeCompare(String(b.id)))
    let labels = null
    for (let len = 1; len <= 3; len++) {
      const candidate = group.map((p) => {
        const last = lastOf(p)
        return last ? `${firstOf(p)} ${last.slice(0, len).toUpperCase()}` : firstOf(p)
      })
      if (new Set(candidate).size === candidate.length) {
        labels = candidate
        break
      }
    }
    if (!labels) labels = group.map((p, i) => `${firstOf(p)} ${i + 1}`)
    group.forEach((p, i) => {
      out[String(p.id)] = labels[i]
    })
  }
  return out
}
