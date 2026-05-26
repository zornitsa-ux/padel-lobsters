import React, { useEffect } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
} from 'react-router-dom'
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
import Admin from './components/Admin.tsx'
import VerificationGate from './components/VerificationGate'
import TransferAccept from './components/TransferAccept'
import LeaguePage from './features/league/LeaguePage'
import LeagueIndexPage from './features/league/LeagueIndexPage'
import GroupStageHistoryPage from './features/league/GroupStageHistoryPage'

// URL routing — replaces the previous string-state page machine.
//
// Existing components were written against an `onNavigate(page, tournament?)`
// helper. Rather than rewrite every consumer in this commit, route shims
// translate that legacy signature into URL navigation via `useLegacyNavigate`.
// Phase 2 feature refactors will switch each component to call useNavigate
// directly and the adapter can be deleted then.
export default function App() {
  return (
    <AppProvider>
      <SetupGuard>
        <BrowserRouter>
          <DeepLinkMigrator />
          <Layout>
            <VerificationGate>
              <Routes>
                <Route path="/" element={<Navigate to="/home" replace />} />
                <Route path="/home" element={<HomeRoute />} />

                <Route path="/events" element={<EventsRoute />} />
                <Route path="/events/:id" element={<EventDetailRoute />} />
                <Route path="/events/:id/schedule" element={<EventScheduleRoute />} />
                <Route path="/events/:id/scores" element={<EventScoresRoute />} />
                <Route path="/events/:id/payments" element={<EventPaymentsRoute />} />
                <Route path="/events/:id/oscars" element={<EventOscarsRoute />} />

                <Route path="/community" element={<CommunityRoute />} />
                <Route path="/community/:id" element={<CommunityRoute />} />

                <Route path="/merch" element={<MerchRoute />} />
                <Route path="/admin" element={<AdminRoute />} />
                <Route path="/settings" element={<SettingsRoute />} />
                <Route path="/history" element={<HistoryRoute />} />
                <Route path="/transfer/:id" element={<TransferRoute />} />
                <Route path="/league" element={<LeagueIndexPage />} />
                <Route path="/league/:id" element={<LeaguePage />} />
                <Route path="/league/:id/group-stage" element={<GroupStageHistoryPage />} />

                <Route path="*" element={<Navigate to="/home" replace />} />
              </Routes>
            </VerificationGate>
          </Layout>
        </BrowserRouter>
      </SetupGuard>
    </AppProvider>
  )
}

// Translate the legacy onNavigate(page, tournament?) signature to URL
// navigation. Existing components keep working without internal changes.
function useLegacyNavigate() {
  const navigate = useNavigate()
  return (page, payload) => {
    const t = payload && typeof payload === 'object' ? payload : null
    switch (page) {
      case 'home':
      case 'dashboard':
        return navigate('/home')
      case 'tournament':
        return navigate('/events')
      case 'registration':
        return t?.id ? navigate(`/events/${t.id}`) : navigate('/events')
      case 'schedule':
        return t?.id ? navigate(`/events/${t.id}/schedule`) : navigate('/events')
      case 'scores':
        return t?.id ? navigate(`/events/${t.id}/scores`) : navigate('/events')
      case 'payments':
        return t?.id ? navigate(`/events/${t.id}/payments`) : navigate('/events')
      case 'game':
        return t?.id ? navigate(`/events/${t.id}/oscars`) : navigate('/events')
      case 'players':
        if (t?.focusPlayerId) return navigate(`/community/${t.focusPlayerId}`)
        return navigate('/community')
      case 'merch':
        return navigate('/merch')
      case 'admin':
        return navigate('/admin')
      case 'merch-orders':
        return navigate('/merch?tab=orders')
      case 'history':
        return navigate('/history')
      case 'settings':
        return navigate('/settings')
      case 'league':
        return navigate('/league')
      default:
        return navigate('/home')
    }
  }
}

// Look up a tournament by URL :id. Returns null while data is still loading
// (route renders nothing) and redirects to /events if the id doesn't exist.
function useTournamentFromUrl() {
  const { id } = useParams()
  const { tournaments } = useApp()
  return tournaments.find((t) => String(t.id) === String(id)) ?? null
}

function HomeRoute() {
  const onNavigate = useLegacyNavigate()
  return <Dashboard onNavigate={onNavigate} />
}

function EventsRoute() {
  const onNavigate = useLegacyNavigate()
  return <Tournament onNavigate={onNavigate} />
}

function EventDetailRoute() {
  const tournament = useTournamentFromUrl()
  const onNavigate = useLegacyNavigate()
  if (!tournament) return <Navigate to="/events" replace />
  return <Registration tournament={tournament} onNavigate={onNavigate} />
}

function EventScheduleRoute() {
  const tournament = useTournamentFromUrl()
  const onNavigate = useLegacyNavigate()
  if (!tournament) return <Navigate to="/events" replace />
  return <Schedule tournament={tournament} onNavigate={onNavigate} />
}

function EventScoresRoute() {
  const tournament = useTournamentFromUrl()
  const onNavigate = useLegacyNavigate()
  if (!tournament) return <Navigate to="/events" replace />
  return <Scores tournament={tournament} onNavigate={onNavigate} />
}

function EventPaymentsRoute() {
  const tournament = useTournamentFromUrl()
  const onNavigate = useLegacyNavigate()
  if (!tournament) return <Navigate to="/events" replace />
  return <Payments tournament={tournament} onNavigate={onNavigate} />
}

function EventOscarsRoute() {
  const tournament = useTournamentFromUrl()
  const onNavigate = useLegacyNavigate()
  if (!tournament) return <Navigate to="/events" replace />
  return <Game tournament={tournament} onNavigate={onNavigate} />
}

function CommunityRoute() {
  const { id } = useParams()
  const onNavigate = useLegacyNavigate()
  return <Players onNavigate={onNavigate} focusPlayerId={id} />
}

function MerchRoute() {
  const [searchParams] = useSearchParams()
  const tab = searchParams.get('tab')
  const onNavigate = useLegacyNavigate()
  return <Merch initialTab={tab} onNavigate={onNavigate} />
}

function SettingsRoute() {
  const onNavigate = useLegacyNavigate()
  return <Settings onNavigate={onNavigate} />
}

function AdminRoute() {
  const onNavigate = useLegacyNavigate()
  return <Admin onNavigate={onNavigate} />
}

function HistoryRoute() {
  const onNavigate = useLegacyNavigate()
  return <History onNavigate={onNavigate} />
}

function TransferRoute() {
  const { id } = useParams()
  const onNavigate = useLegacyNavigate()
  return <TransferAccept transferId={id} onNavigate={onNavigate} />
}

// Backward compatibility for the original ?event=<id> and ?transfer=<id>
// deep links sent by WhatsApp / calendar share. New share links use the
// /events/:id and /transfer/:id routes directly, but old shared messages
// still land on /?event=… so we redirect them on first paint.
function DeepLinkMigrator() {
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const transferId = params.get('transfer')
    if (transferId) {
      navigate(`/transfer/${transferId}`, { replace: true })
      return
    }
    const eventId = params.get('event')
    if (eventId) {
      navigate(`/events/${eventId}`, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
