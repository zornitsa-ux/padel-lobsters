import { Link, Outlet, useLocation } from 'react-router-dom'

const TABS = [
  {
    label: 'Members',
    to: '/community',
    isActive: (p: string) =>
      p === '/community' ||
      (p.startsWith('/community/') && !p.startsWith('/community/shop')),
  },
  {
    label: 'Shop',
    to: '/community/shop',
    isActive: (p: string) => p.startsWith('/community/shop'),
  },
]

export default function CommunityShell() {
  const { pathname } = useLocation()

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {TABS.map(({ label, to, isActive }) => (
          <Link
            key={to}
            to={to}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all text-center ${
              isActive(pathname) ? 'bg-white text-lob-teal shadow-sm' : 'text-gray-500'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
      <Outlet />
    </div>
  )
}
