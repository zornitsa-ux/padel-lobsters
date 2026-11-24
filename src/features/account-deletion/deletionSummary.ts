import { formatDate } from '../events/eventHelpers'
import type { DeletionSummary } from './deletionQueries'

export interface SummaryLine {
  id: string
  text: string
}

/** `self`: the member reads about their own account. `admin`: an admin reads about a member's. */
export type DeletionVoice = 'self' | 'admin'

const plural = ({ count, one, many }: { count: number; one: string; many: string }) =>
  count === 1 ? one : many

const listNames = ({ names }: { names: string[] }) =>
  names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

const TEXT = {
  self: {
    your: 'Your',
    paid: (events: string) =>
      `You've paid for ${events}. Cancelled spots aren't refunded, so if you'd like someone to take your place, transfer the spot to them first.`,
    team: (event: string) =>
      `${event}: if your partner has accepted, they keep your team's spot and can choose a new partner. If not, your team's entry is cancelled.`,
    league: (league: string) =>
      `${league}: you stay on your league team under an anonymous name until an admin finds a replacement.`,
    wiped: 'Your name, email, phone, photo and the rest of your profile are deleted.',
    history:
      'Your past results and matches stay, under a name like "Anonymous Octopus #12", so other players\' results still add up.',
    final:
      "This is final. You can sign up again later with the same email, but you'll start as a new member.",
  },
  admin: {
    your: 'Their',
    paid: (events: string) =>
      `They've paid for ${events}. Cancelled spots aren't refunded; they could transfer the spot to someone first.`,
    team: (event: string) =>
      `${event}: if their partner has accepted, the partner keeps the team's spot and can choose a new partner. If not, the team's entry is cancelled.`,
    league: (league: string) =>
      `${league}: they stay on their league team under an anonymous name until an admin finds a replacement.`,
    wiped: 'Their name, email, phone, photo and the rest of their profile are deleted.',
    history:
      'Their past results and matches stay, under a name like "Anonymous Octopus #12", so other players\' results still add up.',
    final:
      'This is final. They can sign up again later with the same email, but they start as a new member.',
  },
} as const

type Text = (typeof TEXT)[DeletionVoice]

function upcomingLines({ summary, text }: { summary: DeletionSummary; text: Text }): SummaryLine[] {
  const solo = summary.upcoming.filter((spot) => !spot.team)
  if (solo.length === 0) return []
  const lines: SummaryLine[] = [
    {
      id: 'upcoming',
      text: `${text.your} ${plural({ count: solo.length, one: 'spot', many: 'spots' })} in ${listNames(
        { names: solo.map((spot) => `${spot.name} (${formatDate(spot.date)})`) },
      )} will be cancelled.`,
    },
  ]
  const paid = solo.filter((spot) => spot.paid)
  if (paid.length > 0) {
    lines.push({ id: 'paid', text: text.paid(listNames({ names: paid.map((spot) => spot.name) })) })
  }
  return lines
}

function teamLines({ summary, text }: { summary: DeletionSummary; text: Text }): SummaryLine[] {
  return [
    ...summary.team_events.map((team) => ({
      id: `team-${team.tournament_id}`,
      text: text.team(team.name),
    })),
    ...summary.league_teams.map((team) => ({
      id: `league-${team.league_id}`,
      text: text.league(team.league_name),
    })),
  ]
}

function otherLines({ summary, text }: { summary: DeletionSummary; text: Text }): SummaryLine[] {
  const counted = [
    { id: 'transfers', count: summary.pending_transfers, what: 'pending spot transfer' },
    { id: 'shop', count: summary.open_shop_requests, what: 'open shop request' },
  ]
  return counted
    .filter(({ count }) => count > 0)
    .map(({ id, count, what }) => ({
      id,
      text: `${plural({ count, one: `${text.your} ${what}`, many: `${text.your} ${count} ${what}s` })} will be cancelled.`,
    }))
}

/** What deleting this account does, in order of what matters most. */
export function describeDeletion({
  summary,
  voice = 'self',
}: {
  summary: DeletionSummary
  voice?: DeletionVoice
}): SummaryLine[] {
  const text = TEXT[voice]
  return [
    ...upcomingLines({ summary, text }),
    ...teamLines({ summary, text }),
    ...otherLines({ summary, text }),
    { id: 'wiped', text: text.wiped },
    { id: 'history', text: text.history },
    { id: 'final', text: text.final },
  ]
}
