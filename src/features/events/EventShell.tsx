import { Outlet } from 'react-router-dom'
import { useApp } from '../../context/useApp'
import { PageHeader } from '../../components/ui/PageHeader'
import type { PageHeaderTab } from '../../components/ui/PageHeader'
import type { NormalisedTournament } from '../../lib/normalise'
import { useEventPhase } from './useEventPhase'
import { useRegistrations } from './useRegistrations'
import ShareEventButton from './ShareEventButton'
import { isOpenToJoin } from './public/publicEventHelpers'
import { visibleEventTabs } from './eventPhase'
import type { EventTab } from './eventPhase'

const TAB_LABELS: Record<EventTab, string> = {
  info: 'Info',
  me: 'You',
  schedule: 'Schedule',
  results: 'Results',
  oscars: 'Oscars',
  manage: 'Manage',
}

type Props = {
  tournament: NormalisedTournament
}

export default function EventShell({ tournament }: Props) {
  const { isAdmin } = useApp()
  const { phase, oscarsPhase } = useEventPhase(tournament)
  const base = `/events/${tournament.id}`
  const openToJoin = isOpenToJoin({ event: tournament })
  // Same query key as the tabs, so the spots-left count costs no extra fetch.
  const { data: regs } = useRegistrations(openToJoin ? tournament.id : null)
  const registeredCount = regs?.filter((r) => r.status === 'registered').length

  // Which tabs exist is a phase question, not a role question — splitting on
  // `isAdmin` alone is what put a Results tab on events with no scores.
  // `rafflePublished` comes off the tournament row, so opening the Results door
  // for a published raffle costs no extra query here.
  const tabs: PageHeaderTab[] = visibleEventTabs({
    phase,
    isAdmin,
    oscarsPhase,
    rafflePublished: Boolean(tournament.rafflePublishedAt),
  }).map((tab) => ({
    label: TAB_LABELS[tab],
    to: `${base}/${tab}`,
    isActive: (p) => p === `${base}/${tab}`,
  }))

  return (
    <div className="-mx-4">
      <PageHeader
        title={tournament.name}
        backLink={{ to: '/events', label: 'Events' }}
        tabs={tabs}
        rightAction={
          openToJoin && <ShareEventButton event={tournament} registeredCount={registeredCount} />
        }
      />
      <div className="px-4 pt-4">
        <Outlet />
      </div>
    </div>
  )
}
