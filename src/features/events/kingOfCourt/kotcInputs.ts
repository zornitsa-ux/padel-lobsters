import { z } from 'zod'
import { courtSchema, kotcPlayerSchema, kotcTeamSchema } from './domain'
import type { Court, KotcTeam, PlayersById } from './domain'
import type { TeamEntry } from '../teams/teamTypes'
import type { Player } from '../../../lib/normalise'

// The domain's boundary: app shapes are parsed into its contracts here.

export const toKotcTeam = ({ entry }: { entry: TeamEntry }): KotcTeam =>
  kotcTeamSchema.parse({ ...entry.team, partnerId: entry.partner.playerId })

export const toPlayersById = ({
  players,
}: {
  players: Pick<Player, 'id' | 'playtomicLevel'>[]
}): PlayersById =>
  Object.fromEntries(
    players.map((p) => [
      p.id,
      kotcPlayerSchema.parse({ id: p.id, playtomicLevel: p.playtomicLevel ?? null }),
    ]),
  )

export const toCourts = ({ courts }: { courts: unknown }): Court[] =>
  z.array(courtSchema).parse(courts ?? [])
