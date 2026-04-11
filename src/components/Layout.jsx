import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import {
  LayoutDashboard, Users, Trophy,
  Settings, MessageCircle, ShoppingBag, Megaphone, ChevronDown, ChevronUp
} from 'lucide-react'

const ORIGIN = "We didn't plan this. Nobody drafted a mission statement or hired a consultant. One court became two, two became a tournament, and now here we are — a full-blown padel community that somehow keeps showing up. We're competitive enough to care and relaxed enough to laugh about it. Come as you are. Stay for the padel."

const NAV = [
  { id: 'dashboard',  label: 'Home',    icon: LayoutDashboard },
  { id: 'tournament', label: 'Events',  icon: Trophy },
  { id: 'players',    label: 'Players', icon: Users },
  { id: 'updates',    label: 'Updates', icon: Megaphone },
  { id: 'merch',      label: 'Merch',   icon: ShoppingBag },
  { id: 'settings',   label: 'Settings',icon: Settings },
]

const InstagramIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
  </svg>
)

export default function Layout({ children, page, onNavigate }) {
  const { settings } = useApp()
  const [originOpen, setOriginOpen] = useState(false)

  return (
    <div className="min-h-screen bg-lobster-cream flex flex-col max-w-md mx-auto relative">
      {/* Header */}
      <header
        className="text-white px-4 pt-10 pb-3 sticky top-0 z-30 header-gradient"
        style={{
          boxShadow: '0 2px 16px rgba(26,43,48,0.15), 0 4px 32px rgba(217,79,43,0.08)',
        }}
      >
        {/* Top row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-20 h-20 rounded-full flex-shrink-0 overflow-hidden bg-white"
              style={{ boxShadow: '0 0 0 3px rgba(255,255,255,0.3)' }}>
              <img src="/logo-hd.png" alt="Padel Lobsters"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight tracking-tight">Padel Lobsters</h1>
              <p className="text-[10px] opacity-60 leading-tight tracking-wide">Amsterdam Padel Community</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://www.instagram.com/padelobsters?utm_source=qr&igsh=MTVwcHdod3pkanQxaQ=="
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-8 h-8 rounded-2xl text-white transition-all active:scale-95"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
            >
              <InstagramIcon />
            </a>
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
          </div>
        </div>

        {/* Origin story strip */}
        <button
          onClick={() => setOriginOpen(o => !o)}
          className="w-full text-left flex items-start gap-1.5 group"
        >
          <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest shrink-0 mt-0.5">
            Origin story
          </span>
          {originOpen
            ? <ChevronUp size={11} className="text-white/40 shrink-0 mt-0.5" />
            : <ChevronDown size={11} className="text-white/40 shrink-0 mt-0.5" />
          }
          {!originOpen && (
            <span className="text-[11px] text-white/40 italic truncate leading-snug">
              {ORIGIN.slice(0, 55)}…
            </span>
          )}
        </button>
        {originOpen && (
          <p className="text-[11px] text-white/60 italic leading-relaxed mt-1 pb-1">
            {ORIGIN}
          </p>
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
