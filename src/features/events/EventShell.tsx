import { Outlet } from 'react-router-dom'
import { useApp } from '../../context/useApp'
import { PageHeader } from '../../components/ui/PageHeader'
import type { PageHeaderTab } from '../../components/ui/PageHeader'
import type { NormalisedTournament } from '../../lib/normalise'
import { useEventPhase } from './useEventPhase'
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
  const { session } = useApp()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const { phase, oscarsPhase } = useEventPhase(tournament)
  const base = `/events/${tournament.id}`

  // Which tabs exist is a phase question, not a role question — splitting on
  // `isAdmin` alone is what put a Results tab on events with no scores.
  const tabs: PageHeaderTab[] = visibleEventTabs({ phase, isAdmin, oscarsPhase }).map((tab) => ({
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
      />
      <div className="px-4 pt-4">
        <Outlet />
      </div>
    </div>
  )
}
