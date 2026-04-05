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
      <header
        className="text-white px-4 pt-10 pb-4 flex items-center justify-between sticky top-0 z-30 header-gradient"
        style={{
          boxShadow: '0 2px 16px rgba(26,43,48,0.15), 0 4px 32px rgba(217,79,43,0.08)',
        }}
      >
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Padel Lobsters"
            className="w-10 h-10 rounded-full object-cover"
            style={{ boxShadow: '0 0 0 2px rgba(255,255,255,0.3)' }}
          />
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight">Padel Lobsters</h1>
            <p className="text-white/60 text-xs">Tournament Manager</p>
          </div>
        </div>
        {settings?.whatsappLink && (
          <a
            href={settings.whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-white text-xs font-semibold px-3 py-2 rounded-2xl transition-all active:scale-95"
            style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
          >
            <MessageCircle size={14} />
            WhatsApp
          </a>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-5">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white pb-safe z-30"
        style={{ boxShadow: '0 -1px 0 rgba(0,0,0,0.06), 0 -4px 16px rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center justify-around py-2">
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = page === id
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all ${
                  active
                    ? 'bg-lob-coral/15 text-lob-coral'
                    : 'text-lob-muted hover:bg-white/10'
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                <span className={`text-[9px] ${active ? 'font-bold' : 'font-medium'}`}>{label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
