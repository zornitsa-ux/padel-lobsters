export type PlayerNamesById = Record<string, string>

export function playerName({
  id,
  playerNamesById,
}: {
  id: string
  playerNamesById: PlayerNamesById
}): string {
  return playerNamesById[id] ?? id
}
