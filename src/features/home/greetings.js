// ── Fun greetings ────────────────────────────────────────────────────────────
export const GREETINGS_HELLO = [
  (n) => [`Hey, ${n}!`, `Ready to pinch some wins?`],
  (n) => [`${n}!`, `The court is calling — time to play.`],
  (n) => [`Ahoy, ${n}!`, `Time to shell-ebrate some padel.`],
  (n) => [`${n}!`, `Today's forecast: 100% chance of lobster tears.`],
  (n) => [`Welcome back, ${n}!`, `May your lobs be high and your opponents low.`],
  (n) => [`${n}!`, `Time to lob some lobsters.`],
  (n) => [`Snap snap, ${n}!`, `Let's get on the court.`],
  (n) => [`${n}!`, `The lobsters are restless. Show them who's boss.`],
  (n) => [`¡Vamos, ${n}!`, `Menos bla bla, más padel.`],
]

// Launch-day greeting overrides (date string → index into GREETINGS_HELLO)
export const GREETING_OVERRIDES = {
  '2026-04-11': 6, // "Snap snap, {name}! Let's get on the court."
  '2026-04-12': 8, // "¡Vamos, {name}! Menos bla bla, más padel."
}

export function getGreeting(name) {
  const first = (name || 'Lobster').split(' ')[0]
  const today = new Date().toISOString().slice(0, 10)
  if (GREETING_OVERRIDES[today] !== undefined) {
    return GREETINGS_HELLO[GREETING_OVERRIDES[today]](first)
  }
  const dayHash = new Date().getDate() + first.charCodeAt(0)
  return GREETINGS_HELLO[dayHash % GREETINGS_HELLO.length](first)
}
