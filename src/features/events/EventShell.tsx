import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useApp } from '../../context/AppContext'

const PLAYER_TABS = [
  { label: 'Info', path: 'info' },
  { label: 'Schedule', path: 'schedule' },
  { label: 'Results', path: 'results' },
  { label: 'Payments', path: 'payments' },
]

const ADMIN_TABS = [
  { label: 'Oscars', path: 'oscars' },
  { label: 'Raffle', path: 'raffle' },
]

type Props = {
  tournament: { id: string | number; name: string }
}

export default function EventShell({ tournament }: Props) {
  const navigate = useNavigate()
  const { session } = useApp()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const tabs = isAdmin ? [...PLAYER_TABS, ...ADMIN_TABS] : PLAYER_TABS
  const base = `/events/${tournament.id}`

  return (
    <div className="-mx-4 -mt-5">
      {/* Sticky back-button row + tab strip */}
      <div className="sticky top-0 z-20 bg-lob-cream border-b border-gray-200">
        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
          <button
            onClick={() => navigate('/events')}
            className="flex items-center gap-1 text-lob-teal text-sm font-semibold shrink-0"
          >
            <ChevronLeft size={16} />
            Events
          </button>
          <span className="text-lob-muted text-sm shrink-0">·</span>
          <span className="text-sm font-semibold text-lob-dark truncate">{tournament.name}</span>
        </div>

        <div className="overflow-x-auto">
          <div className="flex px-4 min-w-max">
            {tabs.map(({ label, path }) => (
              <NavLink
                key={path}
                to={`${base}/${path}`}
                end
                className={({ isActive }) =>
                  `px-3 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-lob-coral text-lob-coral'
                      : 'border-transparent text-lob-muted'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      </div>

      {/* Active tab content */}
      <div className="px-4 pt-4">
        <Outlet />
      </div>
    </div>
  )
}
