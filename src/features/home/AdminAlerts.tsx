import React from 'react'
import { AlertCircle, Cake } from 'lucide-react'
import type { NormalisedTournament } from '../../lib/normalise'
import type { NormalisedRegistration } from '../events/registrationQueries'
import { upcomingBirthdays, type BirthdayPlayer } from './homeHelpers'
import { TextButton } from '../../components/ui/TextButton'
import { AlertBox } from '../../components/ui/AlertBox'
import { ListCard, ListRow } from '../../components/ui/ListCard'
import { Section } from '../../components/ui/Section'

interface AdminAlertsProps {
  isAdmin: boolean
  unpaid: NormalisedRegistration[]
  upcomingEvent: NormalisedTournament | undefined
  players: BirthdayPlayer[]
  onNavigate: (page: string, tournament?: NormalisedTournament) => void
}

// ── Admin alerts ──────────────────────────────────────── */
// Bundles the two admin-only home-page alerts:
//   • unpaid players for the next event
//   • upcoming birthdays in the next 7 days
// Each renders only when there's something to show. Merch orders used to be a
// third card here; they live in Admin Tools now.
export default function AdminAlerts({
  isAdmin,
  unpaid,
  upcomingEvent,
  players,
  onNavigate,
}: AdminAlertsProps) {
  if (!isAdmin) return null

  const upcoming7 = upcomingBirthdays({ players, today: new Date() })

  return (
    <>
      {unpaid.length > 0 && (
        <AlertBox
          variant="warning"
          icon={<AlertCircle />}
          title={`${unpaid.length} player${unpaid.length > 1 ? 's' : ''} haven't paid yet`}
          action={
            <TextButton tone="warning" onClick={() => onNavigate('payments', upcomingEvent)}>
              View
            </TextButton>
          }
        />
      )}

      {upcoming7.length > 0 && (
        <Section title="Upcoming birthdays" icon={<Cake />}>
          <ListCard>
            {upcoming7.map(({ p, diff }) => (
              <ListRow key={p.id}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-lob-dark">
                    {p.name.split(' ')[0]}
                  </span>
                  <span className="ml-auto text-xs text-lob-muted">{birthdayWhen(diff)}</span>
                </div>
              </ListRow>
            ))}
          </ListCard>
        </Section>
      )}
    </>
  )
}

const birthdayWhen = (diff: number): string =>
  diff === 0 ? 'Today 🎉' : diff === 1 ? 'Tomorrow' : `In ${diff} days`
