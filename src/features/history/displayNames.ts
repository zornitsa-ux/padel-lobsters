// Build a {fullName: displayName} map.
// • If a first name is unique in the input, display = first name only.
// • If multiple players share a first name, append the rest of the name —
//   the original last token if it's already short (≤2 chars, e.g. "Alex M"),
//   otherwise just the last name's initial (e.g. "Daniel Net Hitter" → "Daniel N").
export function buildDisplayNames(names: readonly string[]): Record<string, string> {
  const groups: Record<string, string[]> = {}
  ;(names || []).forEach((n) => {
    if (!n) return
    const f = n.trim().split(/\s+/)[0] || n
    if (!groups[f]) groups[f] = []
    groups[f].push(n)
  })
  const out: Record<string, string> = {}
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
