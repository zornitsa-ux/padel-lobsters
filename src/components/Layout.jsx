import React from 'react'
import { useApp } from '../context/AppContext'
import {
  LayoutDashboard, Users, Trophy,
  History, Settings, MessageCircle, ShoppingBag
} from 'lucide-react'

const NAV = [
  { id: 'dashboard',  label: 'Home',    icon: LayoutDashboard },
  { id: 'tournament', label: 'Events',  icon: Trophy },
  { id: 'players',    label: 'Players', icon: Users },
  { id: 'history',    label: 'History', icon: History },
  { id: 'merch',      label: 'Merch',   icon: ShoppingBag },
  { id: 'settings',   label: 'Settings',icon: Settings },
]

export default function Layout({ children, page, onNavigate }) {
  const { settings } = useApp()

  return (
    <div className="min-h-screen bg-lobster-cream flex flex-col max-w-md mx-auto relative">
      {/* Header */}
      <header className="bg-lobster-teal text-white px-4 pt-10 pb-4 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Padel Lobsters" className="w-10 h-10 rounded-full object-cover" />
          <div>
            <h1 className="font-bold text-lg leading-tight">Padel Lobsters</h1>
            <p className="text-lobster-teal-light text-xs">Tournament Manager</p>
          </div>
        </div>
        {settings?.whatsappLink && (
          <a
            href={settings.whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
          >
            <MessageCircle size={14} />
            WhatsApp
          </a>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 pb-safe z-30">
        <div className="flex items-center justify-around py-1.5">
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = page === id
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all ${
                  active ? 'text-lobster-teal' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                <span className={`text-[9px] font-medium ${active ? 'font-bold' : ''}`}>{label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
