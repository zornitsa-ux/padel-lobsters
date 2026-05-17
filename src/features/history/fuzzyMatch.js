// ── Fuzzy name matching ───────────────────────────────────────────────────────
// Note: `normalize` here matches `normaliseName` in src/lib/playerHistory.js
// behaviourally; we keep a local copy so this feature folder is self-contained
// and doesn't reach across into src/lib for alias-wizard internals.
export function normalize(n) {
  return n.toLowerCase().replace(/[\s.\-_]/g, '')
}

export function editDistance(a, b) {
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

export function areSimilar(a, b) {
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
