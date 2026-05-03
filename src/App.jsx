import React, { useState, useEffect } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import Players from './components/Players'
import Tournament from './components/Tournament'
import Registration from './components/Registration'
import Payments from './components/Payments'
import Schedule from './components/Schedule'
import Scores from './components/Scores'
import Settings from './components/Settings'
import SetupGuard from './components/SetupGuard'
import Merch from './components/Merch'
import History from './components/History'
import Game from './components/Game'
import League from './components/League'
import VerificationGate from './components/VerificationGate'
import TransferAccept from './components/TransferAccept'

export default function App() {
  return (
    <AppProvider>
      <SetupGuard>
        {/* Page-aware auth gating: guests can browse pages in PUBLIC_PAGES
            (src/lib/authPaths.js) without a PIN. Everything else is gated.
            The gate lives inside <Inner /> so it can see the current page. */}
        <Inner />
      </SetupGuard>
    </AppProvider>
  )
}

function Inner() {
  const { tournaments, loading } = useApp()
  const [page, setPage] = useState('dashboard')
  const [selectedTournament, setSelectedTournament] = useState(null)
  // Active transfer id for the /?transfer=<id> deep link. Persisted in
  // component state so a sign-in round-trip (where the URL gets cleaned)
  // doesn't lose the context — the transfer-accept page can still render.
  const [activeTransferId, setActiveTransferId] = useState(null)

  const [merchTab, setMerchTab] = useState(null)

  // Deep links read once at boot:
  //   ?event=<id>    → open the registration page for that tournament
  //   ?transfer=<id> → open the transfer-accept page (Melanie's tap from the
  //                    WhatsApp link sent by Josephine). Has priority over
  //                    ?event= because the same URL can carry both for a
  //                    tournament-scoped offer.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const transferId = params.get('transfer')
    if (transferId) {
      setActiveTransferId(transferId)
      setPage('transfer-accept')
      window.history.replaceState({}, '', window.location.pathname)
      return
    }
    if (loading || tournaments.length === 0) return
    const eventId = params.get('event')
    if (!eventId) return
    const t = tournaments.find((x) => String(x.id) === String(eventId))
    if (t) {
      setSelectedTournament(t)
      setPage('registration')
    }
    // Clean the URL so refreshing doesn't re-trigger
    window.history.replaceState({}, '', window.location.pathname)
  }, [loading, tournaments])

  const navigate = (p, tournament = null) => {
    // Support merch-orders shortcut to go directly to Orders tab
    if (p === 'merch-orders') {
      setMerchTab('orders')
      setPage('merch')
    } else {
      if (p === 'merch') setMerchTab(null) // reset to default
      setPage(p)
    }
    if (tournament !== null) setSelectedTournament(tournament)
    window.scrollTo(0, 0)
  }

  // Guests see the same Dashboard as members — the greeting renders
  // generically when there's no claimed identity, and every onNavigate
  // target that isn't in PUBLIC_PAGES (see authPaths.js) routes through
  // <VerificationGate>, which surfaces the sign-in/up popup. That's how
  // quick-link tiles, sub-tile nav, and event card buttons all trigger
  // the popup for a logged-out visitor without needing a separate surface.
  const pages = {
    dashboard: <Dashboard onNavigate={navigate} />,
    players: <Players onNavigate={navigate} focusPlayerId={selectedTournament?.focusPlayerId} />,
    tournament: <Tournament onNavigate={navigate} />,
    registration: <Registration tournament={selectedTournament} onNavigate={navigate} />,
    payments: <Payments tournament={selectedTournament} onNavigate={navigate} />,
    schedule: <Schedule tournament={selectedTournament} onNavigate={navigate} />,
    scores: <Scores tournament={selectedTournament} onNavigate={navigate} />,
    merch: <Merch tournament={selectedTournament} initialTab={merchTab} onNavigate={navigate} />,
    settings: <Settings onNavigate={navigate} />,
    history: <History onNavigate={navigate} />,
    game: <Game tournament={selectedTournament} onNavigate={navigate} />,
    league: <League onNavigate={navigate} />,
    'transfer-accept': <TransferAccept transferId={activeTransferId} onNavigate={navigate} />,
  }

  return (
    <Layout page={page} onNavigate={navigate}>
      {/* VerificationGate is page-aware: for PUBLIC_PAGES it renders children
          straight through; for everything else it shows the PIN prompt to
          guests. Layout stays visible either way (nav chrome is fine to show
          to guests — clicking a protected tab just triggers the PIN form). */}
      <VerificationGate page={page}>{pages[page] || pages.dashboard}</VerificationGate>
    </Layout>
  )
}
