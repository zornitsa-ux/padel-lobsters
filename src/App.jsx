import React, { useState } from 'react'
import { AppProvider } from './context/AppContext'
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
  const [page, setPage] = useState('dashboard')
  const [selectedTournament, setSelectedTournament] = useState(null)

  const navigate = (p, tournament = null) => {
    setPage(p)
    if (tournament !== null) setSelectedTournament(tournament)
    window.scrollTo(0, 0)
  }

  const pages = {
    dashboard:    <Dashboard onNavigate={navigate} />,
    players:      <Players />,
    tournament:   <Tournament onNavigate={navigate} />,
    registration: <Registration tournament={selectedTournament} onNavigate={navigate} />,
    payments:     <Payments tournament={selectedTournament} onNavigate={navigate} />,
    schedule:     <Schedule tournament={selectedTournament} onNavigate={navigate} />,
    scores:       <Scores tournament={selectedTournament} onNavigate={navigate} />,
    updates:      <Updates />,
    merch:        <Merch tournament={selectedTournament} />,
    settings:     <Settings />,
    history:      <History onNavigate={navigate} />,
    game:         <Game tournament={selectedTournament} onNavigate={navigate} />,
  }

  return (
    <Layout page={page} onNavigate={navigate}>
      {pages[page] || pages.dashboard}
    </Layout>
  )
}
