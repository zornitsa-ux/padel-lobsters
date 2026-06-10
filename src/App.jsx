import React, { useEffect, lazy, Suspense } from 'react'
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
import SetupGuard from './components/SetupGuard'
import VerificationGate from './components/VerificationGate'
import AuthConfirm from './components/AuthConfirm'
import { useEventDataLoader } from './features/events/useEventDataLoader'

// Code-split every route off the first paint. The app shell (Layout,
// VerificationGate, SetupGuard) and the logged-out landing (Dashboard) stay
// in the entry chunk; everything below loads on demand the first time its
// route is hit. Each lazy() becomes its own Rollup chunk — see the bundle
// treemap (`npm run build:analyze`) for the split.
const Players = lazy(() => import('./components/Players'))
const Tournament = lazy(() => import('./components/Tournament'))
const Registration = lazy(() => import('./components/Registration'))
const Payments = lazy(() => import('./components/Payments'))
const Schedule = lazy(() => import('./components/Schedule'))
const Scores = lazy(() => import('./components/Scores'))
const Settings = lazy(() => import('./components/Settings'))
const Merch = lazy(() => import('./components/Merch'))
const History = lazy(() => import('./components/History'))
const Game = lazy(() => import('./components/Game'))
const RaffleContainer = lazy(() => import('./features/raffle/RaffleContainer'))
const RaffleEligibilityContainer = lazy(
  () => import('./features/raffle/RaffleEligibilityContainer'),
)
const Admin = lazy(() => import('./components/Admin.tsx'))
const TransferAccept = lazy(() => import('./components/TransferAccept'))
const LeaguePage = lazy(() => import('./features/league/LeaguePage'))
const LeagueIndexPage = lazy(() => import('./features/league/LeagueIndexPage'))
const GroupStageHistoryPage = lazy(() => import('./features/league/GroupStageHistoryPage'))

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
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<Navigate to="/home" replace />} />
                  <Route path="/home" element={<HomeRoute />} />
                  <Route path="/auth/confirm" element={<AuthConfirm />} />

                  <Route path="/events" element={<EventsRoute />} />
                  <Route path="/events/:id" element={<EventDetailRoute />} />
                  <Route path="/events/:id/schedule" element={<EventScheduleRoute />} />
                  <Route path="/events/:id/scores" element={<EventScoresRoute />} />
                  <Route path="/events/:id/payments" element={<EventPaymentsRoute />} />
                  <Route path="/events/:id/oscars" element={<EventOscarsRoute />} />
                  <Route path="/events/:id/raffle" element={<EventRaffleRoute />} />
                  <Route path="/events/:id/eligibility" element={<EventEligibilityRoute />} />

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
              </Suspense>
            </VerificationGate>
          </Layout>
        </BrowserRouter>
      </SetupGuard>
    </AppProvider>
  )
}

// Shown while a lazily-loaded route chunk is in flight. Kept deliberately
// minimal — the app shell (header/nav) is already painted around it, so this
// only fills the content area for the brief fetch on first visit to a route.
function RouteFallback() {
  return (
    <div className="flex items-center justify-center py-24" role="status" aria-live="polite">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-lob-muted border-t-lob-teal" />
      <span className="sr-only">Loading…</span>
    </div>
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
      case 'raffle':
        return t?.id ? navigate(`/events/${t.id}/raffle`) : navigate('/events')
      case 'eligibility':
        return t?.id ? navigate(`/events/${t.id}/eligibility`) : navigate('/events')
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
// Also mounts useEventDataLoader so matches + registrations load lazily when
// any event route is active (every event route calls this hook).
function useTournamentFromUrl() {
  const { id } = useParams()
  const { tournaments } = useApp()
  useEventDataLoader()
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

function EventRaffleRoute() {
  const tournament = useTournamentFromUrl()
  const { session } = useApp()
  const onNavigate = useLegacyNavigate()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  if (!tournament) return <Navigate to="/events" replace />
  if (!isAdmin) return <Navigate to={`/events/${tournament.id}`} replace />
  return <RaffleContainer tournament={tournament} onNavigate={onNavigate} />
}

function EventEligibilityRoute() {
  const tournament = useTournamentFromUrl()
  const { session } = useApp()
  const onNavigate = useLegacyNavigate()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  if (!tournament) return <Navigate to="/events" replace />
  if (!isAdmin) return <Navigate to={`/events/${tournament.id}`} replace />
  return <RaffleEligibilityContainer tournament={tournament} onNavigate={onNavigate} />
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
