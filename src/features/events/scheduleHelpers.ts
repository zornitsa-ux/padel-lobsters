export interface ShortNamePlayer {
  id: string
  name: string
}

/**
 * Smart short name: returns first name if unique, otherwise first + last-initial.
 * Avoids "Gonzalo" being ambiguous when we have "Gonzalo U" and "Gonzalo E".
 */
export function shortName(player: ShortNamePlayer, allPlayers: readonly ShortNamePlayer[]): string {
  const parts = (player.name || '').split(' ')
  const first = parts[0] || player.name
  const hasDupe = allPlayers.some(
    (other) => other.id !== player.id && (other.name || '').split(' ')[0] === first,
  )
  if (!hasDupe) return first
  // Use first + abbreviated remainder (e.g. "Gonzalo E.")
  return parts.length > 1 ? `${first} ${parts[1][0]}.` : player.name
}
