import { Outlet } from 'react-router-dom'
import { PageHeader } from '../../components/ui/PageHeader'
import type { PageHeaderTab } from '../../components/ui/PageHeader'

const TABS: PageHeaderTab[] = [
  {
    label: 'Members',
    to: '/community',
    isActive: (p) =>
      p === '/community' || (p.startsWith('/community/') && !p.startsWith('/community/shop')),
  },
  {
    label: 'Shop',
    to: '/community/shop',
    isActive: (p) => p.startsWith('/community/shop'),
  },
]

export default function CommunityShell() {
  return (
    <div className="-mx-4">
      <PageHeader title="Community" tabs={TABS} />
      <div className="px-4 pt-4">
        <Outlet />
      </div>
    </div>
  )
}
