import { hasLevel } from '../../lib/level'
import type { Player } from '../../lib/normalise'

/**
 * No level recorded (D-16): no Playtomic level and no levelling start.
 * Until the starts load, `levelledIds` is undefined and only the Playtomic level counts:
 * asking an admin for a level the player already has is harmless (C-7 keeps their start).
 */
export const hasNoLevel = ({
  player,
  levelledIds,
}: {
  player: Pick<Player, 'id' | 'playtomicLevel'>
  levelledIds: ReadonlySet<string> | undefined
}): boolean => !hasLevel({ level: player.playtomicLevel }) && !levelledIds?.has(player.id)
