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
    <div className="-mx-4">
      {/* Sticky app bar: back nav + title + tab strip */}
      <div className="sticky top-0 z-20 border-b border-gray-200">
        {/* Title area — white background lifts it off the cream page */}
        <div className="bg-white px-4 pt-3 pb-2">
          {/* Back button — small and quiet above the title */}
          <button
            onClick={() => navigate('/events')}
            className="flex items-center gap-0.5 text-lob-teal text-xs font-semibold mb-1.5 -ml-0.5 hover:text-lob-teal-dark transition-colors"
          >
            <ChevronLeft size={14} strokeWidth={2.5} />
            Events
          </button>

          {/* Tournament name as a proper page title */}
          <h1 className="text-xl font-semibold text-lob-dark leading-snug truncate">
            {tournament.name}
          </h1>
        </div>

        {/* Tab strip — teal-light band creates a clear visual break from the title */}
        <div className="bg-lob-teal-light overflow-x-auto">
          <div className="flex gap-1 px-3 py-2 min-w-max">
            {tabs.map(({ label, path }) => (
              <NavLink
                key={path}
                to={`${base}/${path}`}
                end
                className={({ isActive }) =>
                  `px-3.5 py-1.5 text-sm font-semibold rounded-full transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-lob-coral text-white shadow-sm'
                      : 'text-lob-teal hover:bg-white/60'
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
