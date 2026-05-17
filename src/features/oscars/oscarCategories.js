/* ─── Default categories (preserves the gender-based rotation from v1) ───── */
export const OSCARS_CORE = [
  { name: 'Best Lobster', icon: '🦞' },
  { name: 'Best Smash', icon: '💥' },
  { name: 'Iron Wall Defence', icon: '🛡️' },
  { name: 'Wildest Shot', icon: '🤪' },
  { name: 'Potty Mouth Award', icon: '🤬' },
  { name: 'Most Excuses', icon: '😴' },
]
export const OSCARS_ROTATING = {
  bar: { name: 'First to the Bar After the Match', icon: '🍺' },
  dressed: { name: 'Best Dressed on Court', icon: '👟' },
  coaching: { name: 'Most Unsolicited Mid-Match Coaching', icon: '💬' },
  unnecessary: { name: 'Most Unnecessary Shot Attempt', icon: '🎭' },
}
export function buildDefaultCategories(regPlayers = []) {
  const men = regPlayers.filter((p) => p.gender === 'male').length
  const women = regPlayers.filter((p) => p.gender === 'female').length
  const extras = []
  if (men > women) extras.push(OSCARS_ROTATING.bar)
  if (women >= 10) extras.push(OSCARS_ROTATING.dressed)
  for (const c of [OSCARS_ROTATING.coaching, OSCARS_ROTATING.unnecessary]) {
    if (extras.length >= 2) break
    extras.push(c)
  }
  return [...OSCARS_CORE, ...extras].map((c, i) => ({ ...c, display_order: i }))
}
