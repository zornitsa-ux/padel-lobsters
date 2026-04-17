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
import Updates from './components/Updates'
import History from './components/History'
import Game from './components/Game'

export default function App() {
  return (
    <AppProvider>
      <SetupGuard>
        <Inner />
      </SetupGuard>
    </AppProvider>
  )
}

function Inner() {
  const { tournaments, loading } = useApp()
  const [page, setPage] = useState('dashboard')
  const [selectedTournament, setSelectedTournament] = useState(null)

  const [merchTab, setMerchTab] = useState(null)

  // Deep-link: ?event=<id> opens the registration page for that tournament
  useEffect(() => {
    if (loading || tournaments.length === 0) return
    const params = new URLSearchParams(window.location.search)
    const eventId = params.get('event')
    if (!eventId) return
    const t = tournaments.find(x => String(x.id) === String(eventId))
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

  const pages = {
    dashboard:    <Dashboard onNavigate={navigate} />,
    players:      <Players onNavigate={navigate} focusPlayerId={selectedTournament?.focusPlayerId} />,
    tournament:   <Tournament onNavigate={navigate} />,
    registration: <Registration tournament={selectedTournament} onNavigate={navigate} />,
    payments:     <Payments tournament={selectedTournament} onNavigate={navigate} />,
    schedule:     <Schedule tournament={selectedTournament} onNavigate={navigate} />,
    scores:       <Scores tournament={selectedTournament} onNavigate={navigate} />,
    updates:      <Updates onNavigate={navigate} />,
    merch:        <Merch tournament={selectedTournament} initialTab={merchTab} onNavigate={navigate} />,
    settings:     <Settings onNavigate={navigate} />,
    history:      <History onNavigate={navigate} />,
    game:         <Game tournament={selectedTournament} onNavigate={navigate} />,
  }

  return (
    <Layout page={page} onNavigate={navigate}>
      {pages[page] || pages.dashboard}
    </Layout>
  )
}
