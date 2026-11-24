import { formatDate } from '../events/eventHelpers'
import type { DeletionSummary } from './deletionQueries'

export interface SummaryLine {
  id: string
  text: string
}

const plural = ({ count, one, many }: { count: number; one: string; many: string }) =>
  count === 1 ? one : many

const listNames = (names: string[]) =>
  names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

function upcomingLines({ upcoming }: Pick<DeletionSummary, 'upcoming'>): SummaryLine[] {
  const solo = upcoming.filter((spot) => !spot.team)
  if (solo.length === 0) return []
  const lines: SummaryLine[] = [
    {
      id: 'upcoming',
      text: `Your ${plural({ count: solo.length, one: 'spot', many: 'spots' })} in ${listNames(
        solo.map((spot) => `${spot.name} (${formatDate(spot.date)})`),
      )} will be cancelled.`,
    },
  ]
  const paid = solo.filter((spot) => spot.paid)
  if (paid.length > 0) {
    lines.push({
      id: 'paid',
      text: `You've paid for ${listNames(paid.map((spot) => spot.name))}. Cancelled spots aren't refunded, so if you'd like someone to take your place, transfer the spot to them first.`,
    })
  }
  return lines
}

function teamLines({ team_events, league_teams }: DeletionSummary): SummaryLine[] {
  const lines: SummaryLine[] = team_events.map((team) => ({
    id: `team-${team.tournament_id}`,
    text: `${team.name}: if your partner has accepted, they keep your team's spot and can choose a new partner. If not, your team's entry is cancelled.`,
  }))
  return lines.concat(
    league_teams.map((team) => ({
      id: `league-${team.league_id}`,
      text: `${team.league_name}: you stay on your league team under an anonymous name until an admin finds a replacement.`,
    })),
  )
}

function otherLines({ pending_transfers, open_shop_requests }: DeletionSummary): SummaryLine[] {
  const lines: SummaryLine[] = []
  if (pending_transfers > 0) {
    lines.push({
      id: 'transfers',
      text: `${plural({ count: pending_transfers, one: 'Your pending spot transfer', many: `Your ${pending_transfers} pending spot transfers` })} will be cancelled.`,
    })
  }
  if (open_shop_requests > 0) {
    lines.push({
      id: 'shop',
      text: `${plural({ count: open_shop_requests, one: 'Your open shop request', many: `Your ${open_shop_requests} open shop requests` })} will be cancelled.`,
    })
  }
  return lines
}

const ALWAYS: SummaryLine[] = [
  {
    id: 'wiped',
    text: 'Your name, email, phone, photo and the rest of your profile are deleted.',
  },
  {
    id: 'history',
    text: 'Your past results and matches stay, under a name like "Anonymous Octopus #12", so other players\' results still add up.',
  },
  {
    id: 'final',
    text: "This is final. You can sign up again later with the same email, but you'll start as a new member.",
  },
]

/** What deleting this account does, in order of what the member most needs to know. */
export function describeDeletion({ summary }: { summary: DeletionSummary }): SummaryLine[] {
  return [...upcomingLines(summary), ...teamLines(summary), ...otherLines(summary), ...ALWAYS]
}
