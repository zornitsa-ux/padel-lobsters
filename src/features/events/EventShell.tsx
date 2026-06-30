import { Outlet } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { PageHeader } from '../../components/ui/PageHeader'
import type { PageHeaderTab } from '../../components/ui/PageHeader'

const PLAYER_TAB_PATHS = [
  { label: 'Info', path: 'info' },
  { label: 'Schedule', path: 'schedule' },
  { label: 'Results', path: 'results' },
]
const ADMIN_TAB_PATHS = [
  { label: 'Payments', path: 'payments' },
  { label: 'Oscars', path: 'oscars' },
  { label: 'Raffle', path: 'raffle' },
]

type Props = {
  tournament: { id: string | number; name: string }
}

export default function EventShell({ tournament }: Props) {
  const { session } = useApp()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const base = `/events/${tournament.id}`

  const tabDefs = isAdmin ? [...PLAYER_TAB_PATHS, ...ADMIN_TAB_PATHS] : PLAYER_TAB_PATHS
  const tabs: PageHeaderTab[] = tabDefs.map(({ label, path }) => ({
    label,
    to: `${base}/${path}`,
    isActive: (p) => p === `${base}/${path}`,
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
