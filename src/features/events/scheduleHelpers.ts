import { firstName, isAnonymisedName, nameParts } from '../../lib/playerName'

export interface ShortNamePlayer {
  id: string
  name: string
}

/**
 * Smart short name: returns first name if unique, otherwise first + last-initial.
 * Avoids "Gonzalo" being ambiguous when we have "Gonzalo U" and "Gonzalo E".
 */
export function shortName(player: ShortNamePlayer, allPlayers: readonly ShortNamePlayer[]): string {
  const parts = nameParts(player.name)
  const first = firstName({ name: player.name, fallback: player.name })
  const hasDupe = allPlayers.some(
    (other) => other.id !== player.id && firstName({ name: other.name }) === first,
  )
  if (!hasDupe || isAnonymisedName(player.name)) return first
  // Use first + abbreviated remainder (e.g. "Gonzalo E.")
  return parts.length > 1 ? `${first} ${parts[1][0]}.` : player.name
}
