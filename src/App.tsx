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
import { AppProvider } from './context/AppContext'
import { useEventPhase } from './features/events/useEventPhase'
import { defaultEventTab } from './features/events/eventPhase'
import { EventRouteGuard, AdminEventRouteGuard } from './features/events/EventRouteGuard'
import type { NormalisedTournament } from './lib/normalise'
import Layout from './components/Layout'
import { RouteFallback } from './components/ui/RouteFallback'
import Dashboard from './features/home/Dashboard'
import VerificationGate from './components/VerificationGate'
import AuthConfirm from './components/AuthConfirm'
import { mark } from './lib/perfMarks'
import EventShell from './features/events/EventShell'
import type { EventNavigate } from './features/events/eventHelpers'
import CommunityShell from './features/community/CommunityShell'

// Code-split every route off the first paint. The app shell (Layout,
// VerificationGate) and the logged-out landing (Dashboard) stay
// in the entry chunk; everything below loads on demand the first time its
// route is hit. Each lazy() becomes its own Rollup chunk — see the bundle
// treemap (`npm run build:analyze`) for the split.
const Players = lazy(() => import('./features/community/Players'))
const Tournament = lazy(() => import('./features/events/Tournament'))
const Registration = lazy(() => import('./features/events/Registration'))
const MyTournament = lazy(() => import('./features/events/MyTournament'))
const EventManage = lazy(() => import('./features/events/EventManage'))
const Schedule = lazy(() => import('./features/events/Schedule'))
const Scores = lazy(() => import('./features/events/Scores'))
const Merch = lazy(() => import('./features/merch/Merch'))
const Account = lazy(() => import('./features/settings/Settings'))
const Game = lazy(() => import('./features/oscars/Game'))
const Admin = lazy(() => import('./features/admin/AdminTools'))
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
  useEffect(() => mark('react-mount'), [])
  return (
    <AppProvider>
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
                <Route path="/events/:id" element={<EventShellRoute />}>
                  <Route index element={<EventIndexRoute />} />
                  <Route path="info" element={<EventDetailRoute />} />
                  <Route path="me" element={<EventMeRoute />} />
                  <Route path="schedule" element={<EventScheduleRoute />} />
                  <Route path="results" element={<EventScoresRoute />} />
                  <Route path="scores" element={<Navigate to="../results" replace />} />
                  <Route path="oscars" element={<EventOscarsRoute />} />
                  <Route path="manage" element={<EventManageRoute />} />
                </Route>

                <Route path="/community" element={<CommunityShell />}>
                  <Route index element={<CommunityMembersRoute />} />
                  <Route path="shop" element={<MerchRoute />} />
                  <Route path=":id" element={<CommunityMembersRoute />} />
                </Route>

                <Route path="/merch" element={<Navigate to="/community/shop" replace />} />
                <Route path="/admin" element={<AdminRoute />} />
                <Route path="/account" element={<AccountRoute />} />
                <Route path="/settings" element={<Navigate to="/account" replace />} />
                <Route path="/history" element={<Navigate to="/events" replace />} />
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
    </AppProvider>
  )
}

// Translate the legacy onNavigate(page, tournament?) signature to URL
// navigation. Existing components keep working without internal changes.
function useLegacyNavigate(): EventNavigate {
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
        return t?.id ? navigate(`/events/${t.id}/info`) : navigate('/events')
      case 'schedule':
        return t?.id ? navigate(`/events/${t.id}/schedule`) : navigate('/events')
      case 'scores':
        return t?.id ? navigate(`/events/${t.id}/results`) : navigate('/events')
      // Payments, raffle and eligibility are sections of /manage now, not
      // routes of their own — navigate straight there rather than via a hop.
      case 'payments':
        return t?.id ? navigate(`/events/${t.id}/manage?section=payments`) : navigate('/events')
      case 'game':
        return t?.id ? navigate(`/events/${t.id}/oscars`) : navigate('/events')
      case 'raffle':
        return t?.id ? navigate(`/events/${t.id}/manage?section=raffle`) : navigate('/events')
      case 'eligibility':
        return t?.id ? navigate(`/events/${t.id}/manage?section=eligibility`) : navigate('/events')
      case 'players':
        if (t?.focusPlayerId) return navigate(`/community/${t.focusPlayerId}`)
        return navigate('/community')
      case 'merch':
        return navigate('/community/shop')
      case 'admin':
        return navigate('/admin')
      case 'merch-orders':
        return navigate('/community/shop?tab=orders')
      case 'history':
        return navigate('/events')
      case 'settings':
        return navigate('/account')
      case 'league':
        return navigate('/league')
      default:
        return navigate('/home')
    }
  }
}

function HomeRoute() {
  const onNavigate = useLegacyNavigate()
  return <Dashboard onNavigate={onNavigate} />
}

function EventsRoute() {
  const onNavigate = useLegacyNavigate()
  return <Tournament onNavigate={onNavigate} />
}

function EventShellRoute() {
  return <EventRouteGuard>{(tournament) => <EventShell tournament={tournament} />}</EventRouteGuard>
}

// `/events/:id` with no tab named — lands wherever the phase says is most
// useful (during Live that is the player's own tournament, not Info).
function EventIndexRoute() {
  return (
    <EventRouteGuard>
      {(tournament) => <EventDefaultTabRedirect tournament={tournament} />}
    </EventRouteGuard>
  )
}

function EventDefaultTabRedirect({ tournament }: { tournament: NormalisedTournament }) {
  const { phase } = useEventPhase(tournament)
  return <Navigate to={defaultEventTab({ phase })} replace />
}

function EventDetailRoute() {
  const onNavigate = useLegacyNavigate()
  return (
    <EventRouteGuard>
      {(tournament) => <Registration tournament={tournament} onNavigate={onNavigate} />}
    </EventRouteGuard>
  )
}

function EventMeRoute() {
  const onNavigate = useLegacyNavigate()
  return (
    <EventRouteGuard>
      {(tournament) => <MyTournament tournament={tournament} onNavigate={onNavigate} />}
    </EventRouteGuard>
  )
}

function EventScheduleRoute() {
  const onNavigate = useLegacyNavigate()
  return (
    <EventRouteGuard>
      {(tournament) => <Schedule tournament={tournament} onNavigate={onNavigate} />}
    </EventRouteGuard>
  )
}

function EventScoresRoute() {
  const onNavigate = useLegacyNavigate()
  return (
    <EventRouteGuard>
      {(tournament) => <Scores tournament={tournament} onNavigate={onNavigate} />}
    </EventRouteGuard>
  )
}

function EventOscarsRoute() {
  const onNavigate = useLegacyNavigate()
  return (
    <EventRouteGuard>
      {(tournament) => <Game tournament={tournament} onNavigate={onNavigate} />}
    </EventRouteGuard>
  )
}

function EventManageRoute() {
  const onNavigate = useLegacyNavigate()
  return (
    <AdminEventRouteGuard>
      {(tournament) => <EventManage tournament={tournament} onNavigate={onNavigate} />}
    </AdminEventRouteGuard>
  )
}

function CommunityMembersRoute() {
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

function AccountRoute() {
  return <Account />
}

function AdminRoute() {
  const onNavigate = useLegacyNavigate()
  return <Admin onNavigate={onNavigate} />
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
