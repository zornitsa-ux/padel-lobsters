import type { Violation } from '../domain/types'

type Names = Record<string, string>

const where = ({ round, court }: Pick<Violation, 'round' | 'court'>): string =>
  court === null ? `Round ${round}` : `Round ${round}, Court ${court}`

const idsInOrder = ({ reason, names }: { reason: string; names: Names }): string[] =>
  Object.keys(names)
    .map((id) => ({ id, at: reason.indexOf(id) }))
    .filter(({ at }) => at >= 0)
    .sort((a, b) => a.at - b.at)
    .map(({ id }) => id)

const withNames = ({ reason, names }: { reason: string; names: Names }): string =>
  idsInOrder({ reason, names }).reduce((text, id) => text.split(id).join(names[id]), reason)

function describe({ violation, names }: { violation: Violation; names: Names }): string {
  const { rule, reason } = violation
  const pair = idsInOrder({ reason, names })
    .slice(0, 2)
    .map((id) => names[id])
    .join(' & ')
  if (rule === 'partner-repeat' && pair) return `${pair} partner again`
  if (rule === 'lefty' && pair) return `Two left-handers on one team (${pair})`
  return withNames({ reason, names })
}

export const violationLine = ({
  violation,
  names,
}: {
  violation: Violation
  names: Names
}): string => `${where(violation)} — ${describe({ violation, names })}`

export function violationsSummary({
  violations,
  names,
}: {
  violations: readonly Violation[]
  names: Names
}): string | null {
  if (violations.length === 0) return null
  const count = `${violations.length} rule ${violations.length === 1 ? 'break' : 'breaks'}`
  return `${count}: ${violations.map((violation) => violationLine({ violation, names })).join('; ')}`
}

type NamedPlayer = { playerId: string; name: string }

export function playerNamesById({
  rounds,
}: {
  rounds: readonly {
    courts: readonly { players: readonly NamedPlayer[] }[]
    sitters: readonly NamedPlayer[]
  }[]
}): Names {
  const names: Names = {}
  for (const round of rounds) {
    const everyone = [...round.courts.flatMap((court) => court.players), ...round.sitters]
    for (const player of everyone) names[player.playerId] = player.name
  }
  return names
}
