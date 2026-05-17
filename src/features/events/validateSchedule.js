// ── Post-generation validation ──────────────────────────────────────────────
// Scans every round and returns a list of human-readable warnings so the
// admin can see at a glance whether the engine had to break any rule.

export default function validateSchedule(rounds, allPlayers, genderMode) {
  const warnings = []
  const getName = (id) => {
    const p = allPlayers.find((x) => x.id === id)
    return p ? (p.name || '').split(' ')[0] : id
  }
  const isLefty = (id) => allPlayers.find((x) => x.id === id)?.isLeftHanded
  const isFemale = (id) => allPlayers.find((x) => x.id === id)?.gender === 'female'
  const isMixed = genderMode === 'mixed'

  // ── Unavoidable gender-clash analysis ─────────────────────────────────────
  // With an odd number of women (e.g. 7W + 9M = 16), you physically cannot
  // avoid at least one court per round being "mixed vs all-male" — a woman
  // has to partner a man and play against a male-male team. Flagging this
  // as a hard error is misleading because the admin can't "fix" it. We
  // compute the minimum unavoidable clash count per round up-front, then
  // mark the first N gender-clashes per round as informational instead of
  // an error. Any EXTRA clashes above N are still real errors (the engine
  // should have done better).
  const womenCount = allPlayers.filter((p) => p.gender === 'female').length
  const menCount = allPlayers.length - womenCount
  const teams = Math.floor(allPlayers.length / 2)
  // unavoidableMismatchPerRound = sum of |w1 - w2| per round physically
  // forced by the W/M split. Odd women + women <= teams ⇒ one court must
  // be 1W1M vs 0W2M (mismatch = 1).
  let unavoidableMismatchPerRound = 0
  if (isMixed && womenCount > 0 && menCount > 0) {
    if (womenCount <= teams) {
      unavoidableMismatchPerRound = womenCount % 2 === 1 ? 1 : 0
    } else {
      const excess = womenCount - teams
      unavoidableMismatchPerRound = excess % 2 === 1 ? 1 : 0
    }
  }
  if (isMixed && womenCount > 0 && womenCount % 2 === 1) {
    warnings.push({
      type: 'gender-odd-women',
      severity: 'info',
      round: 0,
      message: `Odd number of women (${womenCount}). With ${womenCount}W + ${menCount}M, one court per round will have 1 woman vs an all-male team — that's unavoidable. Other courts should still be balanced.`,
    })
  }
  // Per-round running sum of mismatch already counted toward the unavoidable quota.
  const mismatchUsedByRound = {}

  // Track partnerships and opponents across rounds
  const partnersSeen = {} // "idA:idB" → [round numbers]
  const opponentsSeen = {} // "idA:idB" → [round numbers]
  // Per-round counts of all-male / all-female courts (one summary row per round)
  const allMaleByRound = {}
  const allFemaleByRound = {}
  const totalMatchesByRound = {}

  // Roster we expect every round to cover — respect "sitting" for formats that
  // rotate a subset per round. If no sitting array was set, every player
  // should play every round.
  const allPlayerIds = new Set(allPlayers.map((p) => String(p.id)))

  rounds.forEach((r) => {
    // Rule 0: per-round coverage — every active player appears exactly once,
    // no player appears twice, no foreign player sneaks in. If the generator
    // produced a valid round this is always true; if it didn't, the admin
    // needs to know instead of finding out mid-tournament.
    const sittingIds = new Set((r.sitting || []).map(String))
    const expected = new Set([...allPlayerIds].filter((id) => !sittingIds.has(id)))
    const seen = new Map() // id → count
    const foreign = []
    ;(r.matches || []).forEach((m) => {
      ;[...(m.team1Ids || []), ...(m.team2Ids || [])].forEach((id) => {
        const sid = String(id)
        seen.set(sid, (seen.get(sid) || 0) + 1)
        if (!allPlayerIds.has(sid)) foreign.push(sid)
      })
    })
    const missing = [...expected].filter((id) => !seen.has(id))
    const duplicates = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id)
    if (missing.length > 0) {
      warnings.push({
        type: 'round-missing-players',
        severity: 'error',
        round: r.round,
        message: `❌ ${missing.length} registered player${missing.length === 1 ? '' : 's'} not scheduled this round: ${missing.map(getName).join(', ')}`,
      })
    }
    if (duplicates.length > 0) {
      warnings.push({
        type: 'round-duplicate-players',
        severity: 'error',
        round: r.round,
        message: `⚠️ ${duplicates.map(getName).join(', ')} appear${duplicates.length === 1 ? 's' : ''} on more than one court this round`,
      })
    }
    if (foreign.length > 0) {
      warnings.push({
        type: 'round-foreign-players',
        severity: 'error',
        round: r.round,
        message: `❌ Non-registered player${foreign.length === 1 ? '' : 's'} in this round`,
      })
    }

    totalMatchesByRound[r.round] = (r.matches || []).length
    ;(r.matches || []).forEach((m) => {
      const t1 = m.team1Ids || []
      const t2 = m.team2Ids || []

      // Rule 1: repeat partners
      const checkPair = (ids) => {
        if (ids.length !== 2) return
        const key = [...ids].sort().join(':')
        if (!partnersSeen[key]) partnersSeen[key] = []
        partnersSeen[key].push(r.round)
        if (partnersSeen[key].length === 2) {
          warnings.push({
            type: 'repeat-partner',
            severity: 'error',
            round: r.round,
            message: `🔁 ${getName(ids[0])} & ${getName(ids[1])} are partners again (also round ${partnersSeen[key][0]})`,
          })
        }
      }
      checkPair(t1)
      checkPair(t2)

      // Rule 2: two lefties on same team
      const checkLefties = (ids, teamLabel) => {
        const lefties = ids.filter(isLefty)
        if (lefties.length >= 2) {
          warnings.push({
            type: 'double-lefty',
            severity: 'error',
            round: r.round,
            message: `🫲 Two left-handers on ${teamLabel}: ${lefties.map(getName).join(' & ')}`,
          })
        }
      }
      checkLefties(t1, `Court ${m.court}`)
      checkLefties(t2, `Court ${m.court}`)

      // Rule 3: gender mismatch on court. Each team should have the same
      // number of women. Mismatch = |w1 - w2|: 0 = balanced, 1 = one extra
      // woman on one side (e.g. 1W1M vs 0W2M, or 2W0M vs 1W1M = 3W on court),
      // 2 = totally lopsided (2W0M vs 0W2M = 3W on court).
      if (isMixed) {
        const w1 = t1.filter(isFemale).length
        const w2 = t2.filter(isFemale).length
        const diff = Math.abs(w1 - w2)
        if (diff > 0) {
          const used = mismatchUsedByRound[r.round] || 0
          const withinQuota = used + diff <= unavoidableMismatchPerRound
          mismatchUsedByRound[r.round] = used + diff
          const t1Lbl = `${w1}W${2 - w1}M`
          const t2Lbl = `${w2}W${2 - w2}M`
          warnings.push({
            type: 'gender-mismatch',
            severity: withinQuota ? 'info' : 'error',
            round: r.round,
            message: withinQuota
              ? `${m.court}: ${t1.map(getName).join('+')} (${t1Lbl}) vs ${t2.map(getName).join('+')} (${t2Lbl}) — unavoidable with ${womenCount} women`
              : `⚥ Gender imbalance on ${m.court}: ${t1.map(getName).join('+')} (${t1Lbl}) vs ${t2.map(getName).join('+')} (${t2Lbl})`,
          })
        }
        // Track all-male / all-female courts per round; summary at the end.
        if (w1 === 0 && w2 === 0) {
          allMaleByRound[r.round] = (allMaleByRound[r.round] || 0) + 1
        }
        if (w1 === 2 && w2 === 2) {
          allFemaleByRound[r.round] = (allFemaleByRound[r.round] || 0) + 1
        }
      }

      // Rule 4: repeat opponents
      t1.forEach((a) =>
        t2.forEach((b) => {
          const key = [a, b].sort().join(':')
          if (!opponentsSeen[key]) opponentsSeen[key] = []
          opponentsSeen[key].push(r.round)
        }),
      )
    })
  })

  // Per-round all-male / all-female summary (one row per round)
  Object.keys(totalMatchesByRound).forEach((round) => {
    const total = totalMatchesByRound[round]
    const am = allMaleByRound[round] || 0
    const af = allFemaleByRound[round] || 0
    if (am === 0 && af === 0) return
    const parts = []
    if (am > 0) parts.push(`${am}/${total} Men`)
    if (af > 0) parts.push(`${af}/${total} Ladies`)
    warnings.push({
      type: 'gender-court-composition',
      severity: 'info',
      round: Number(round),
      message: `R${round}: ${parts.join(' · ')}`,
    })
  })

  // Collect repeat opponents (only warn when 3+ meetings — 2 is expected
  // in small pools and doesn't feel like an issue to players).
  Object.entries(opponentsSeen).forEach(([key, rnds]) => {
    if (rnds.length >= 3) {
      const [a, b] = key.split(':')
      warnings.push({
        type: 'repeat-opponent',
        severity: 'warning',
        round: rnds[rnds.length - 1],
        message: `👥 ${getName(a)} & ${getName(b)} face each other ${rnds.length} times (rounds ${rnds.join(', ')})`,
      })
    }
  })

  return warnings
}
