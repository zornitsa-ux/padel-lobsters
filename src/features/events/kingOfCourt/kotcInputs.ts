import { z } from 'zod'
import { courtSchema, kotcPlayerSchema, kotcTeamSchema } from './domain'
import type { Court, KotcTeam, PlayersById } from './domain'
import type { TeamEntry } from '../teams/teamTypes'
import type { Player } from '../../../lib/normalise'
import type { MmRating } from '../../matchmaking/generateSchedule.service'

// The domain's boundary: app shapes are parsed into its contracts here.

export const toKotcTeam = ({ entry }: { entry: TeamEntry }): KotcTeam =>
  kotcTeamSchema.parse({ ...entry.team, partnerId: entry.partner.playerId })

// mm_* is admin-only (DESIGN §5 of Matchmaking V2), so players' views seed
// from playtomic_level alone; published seeds make the two agree.
export const toPlayersById = ({
  players,
  mmRatings = {},
}: {
  players: Pick<Player, 'id' | 'playtomicLevel'>[]
  mmRatings?: Record<string, MmRating>
}): PlayersById =>
  Object.fromEntries(
    players.map((p) => [
      p.id,
      kotcPlayerSchema.parse({
        id: p.id,
        mmRating: mmRatings[p.id]?.mu ?? null,
        playtomicLevel: p.playtomicLevel ?? null,
      }),
    ]),
  )

export const toCourts = ({ courts }: { courts: unknown }): Court[] =>
  z.array(courtSchema).parse(courts ?? [])
