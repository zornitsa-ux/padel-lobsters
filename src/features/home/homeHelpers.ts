import type { Player, NormalisedTournament } from '../../lib/normalise'
import { isEventUpcoming } from '../events/eventPhase'
import { tournamentStartMs } from '../../lib/tournamentStart'

// Pure derivations behind the home-screen cards. They live outside the
// components so they can be unit-tested (and so the component modules stay
// component-only for React Fast Refresh).

export type BirthdayPlayer = Pick<Player, 'id' | 'name' | 'birthday'>

export interface UpcomingBirthday {
  p: BirthdayPlayer
  diff: number
}

const DAY_MS = 86400000

// Days until each player's next birthday, nearest first, capped at a week out.
// `today` is injected so the boundary days are testable without clock mocking.
export function upcomingBirthdays({
  players,
  today,
}: {
  players: BirthdayPlayer[]
  today: Date
}): UpcomingBirthday[] {
  const midnight = new Date(today)
  midnight.setHours(0, 0, 0, 0)
  return players
    .filter((p) => p.birthday)
    .map((p) => {
      const d = new Date(p.birthday as string)
      let bday = new Date(midnight.getFullYear(), d.getMonth(), d.getDate())
      if (bday < midnight) bday = new Date(midnight.getFullYear() + 1, d.getMonth(), d.getDate())
      const diff = Math.round((bday.getTime() - midnight.getTime()) / DAY_MS)
      return { p, diff }
    })
    .filter(({ diff }) => diff <= 7)
    .sort((a, b) => a.diff - b.diff)
}

// Per-person cost: one total price split across the player cap.
export function perPersonCost(
  tournament: Pick<NormalisedTournament, 'totalPrice' | 'maxPlayers'>,
): number {
  const total = tournament.totalPrice || 0
  const maxPlayers = tournament.maxPlayers || 16
  return total > 0 ? total / maxPlayers : 0
}

const byDate = (a: NormalisedTournament, b: NormalisedTournament) =>
  (a.date || '') < (b.date || '') ? -1 : 1

export function upcomingEvents<T extends NormalisedTournament>({ events }: { events: T[] }): T[] {
  return events.filter((t) => isEventUpcoming({ tournament: t })).sort(byDate)
}

/** The nearest event whose start is still ahead, so the clock flips once one starts. */
export function countdownTarget<T extends NormalisedTournament>({
  events,
  now = Date.now(),
}: {
  events: T[]
  now?: number
}): T | null {
  return (
    upcomingEvents({ events }).find((t) => {
      const start = tournamentStartMs(t)
      return start !== null && start > now
    }) ?? null
  )
}

export function tipOfTheDay({ tips, date = new Date() }: { tips: string[]; date?: Date }): string {
  const dayIndex = (date.getFullYear() * 366 + date.getMonth() * 31 + date.getDate()) % tips.length
  return tips[dayIndex]
}

export function formatHomeDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}
