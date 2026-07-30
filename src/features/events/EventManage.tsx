import { lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { StatTile } from '../../components/ui/StatTile'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { Spinner } from '../../components/ui/Spinner'
import { useMatches } from './useMatches'
import { useRegistrations } from './useRegistrations'
import { useEventPhase } from './useEventPhase'
import { allMatchesScored, isMatchScored, isRunOfShowVisible } from './eventPhase'
import RunOfShow from './RunOfShow'
import type { NormalisedTournament } from '../../lib/normalise'
import type { EventNavigate } from './eventHelpers'

// Heavy sections were previously their own lazy routes (App.tsx); now they
// mount inside /manage, so the split moves here — the overview no longer
// pulls the raffle bundle just because /manage was visited.
const Payments = lazy(() => import('./Payments'))
const RaffleContainer = lazy(() => import('../raffle/RaffleContainer'))
const RaffleEligibilityContainer = lazy(() => import('../raffle/RaffleEligibilityContainer'))

type Section = 'overview' | 'payments' | 'raffle' | 'eligibility'

const SECTIONS: readonly Section[] = ['overview', 'payments', 'raffle', 'eligibility']

const SECTION_LABELS: Record<Section, string> = {
  overview: 'Overview',
  payments: 'Payments',
  raffle: 'Raffle',
  eligibility: 'Eligibility',
}

const isSection = (value: string | null): value is Section => SECTIONS.includes(value as Section)

type Props = {
  tournament: NormalisedTournament
  onNavigate: EventNavigate
}

export default function EventManage({ tournament, onNavigate }: Props) {
  const [searchParams, setSearchParams] = useSearchParams()
  const section: Section = isSection(searchParams.get('section'))
    ? (searchParams.get('section') as Section)
    : 'overview'

  const setSection = (next: Section) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'overview') params.delete('section')
    else params.set('section', next)
    setSearchParams(params)
  }

  return (
    <div className="space-y-4" data-testid="event-manage">
      <SegmentedControl
        options={SECTIONS.map((value) => ({ value, label: SECTION_LABELS[value] }))}
        value={section}
        onChange={setSection}
        layout="scroll"
        ariaLabel="Manage section"
      />

      {section === 'overview' && <Overview tournament={tournament} />}

      {section === 'payments' && (
        <Suspense fallback={<Spinner />}>
          <Payments tournament={tournament} onNavigate={onNavigate} />
        </Suspense>
      )}

      {section === 'raffle' && (
        <Suspense fallback={<Spinner />}>
          <RaffleContainer tournament={tournament} onNavigate={onNavigate} />
        </Suspense>
      )}

      {section === 'eligibility' && (
        <Suspense fallback={<Spinner />}>
          <RaffleEligibilityContainer tournament={tournament} onNavigate={onNavigate} />
        </Suspense>
      )}
    </div>
  )
}

function Overview({ tournament }: { tournament: NormalisedTournament }) {
  const { data: matches = [] } = useMatches(tournament.id)
  const { data: regsData = [] } = useRegistrations(tournament.id)
  const { phase } = useEventPhase(tournament)

  const registered = regsData.filter((r) => r.status === 'registered')
  const unpaid = registered.filter((r) => !r.paymentStatus || r.paymentStatus === 'unpaid')
  const scoredCount = matches.filter(isMatchScored).length
  const sealed = allMatchesScored(matches)

  // Closes over `tournament` so the exact slot below stays prop-free, per the
  // run-of-show contract — RunOfShow itself is owned by workstream C.
  const RunOfShowSlot = () => <RunOfShow tournament={tournament} />

  return (
    <div className="space-y-4">
      <div className="card grid grid-cols-3 gap-2">
        <StatTile value={registered.length} label="Registered" />
        <StatTile
          value={unpaid.length}
          label="Unpaid"
          valueClassName={unpaid.length > 0 ? 'text-red-600' : ''}
        />
        <StatTile
          value={matches.length > 0 ? `${scoredCount}/${matches.length}` : '—'}
          label="Scored"
        />
      </div>

      <div className="card space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-lob-dark">Scoring progress</p>
          <p className="text-xs text-lob-muted">
            {matches.length === 0
              ? 'No schedule yet'
              : `${scoredCount} of ${matches.length} matches scored`}
          </p>
        </div>
        <ProgressBar value={matches.length > 0 ? (scoredCount / matches.length) * 100 : 0} />
        {sealed && <p className="text-xs text-lob-teal font-semibold">All matches scored</p>}
      </div>

      {/* The end-of-event sequence. Owned by RunOfShow — see workstream C. */}
      {isRunOfShowVisible({ phase, isAdmin: true }) && <RunOfShowSlot />}
    </div>
  )
}
