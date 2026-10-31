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
import { isKingOfTheCourt } from './eventFormat'
import RunOfShow from './RunOfShow'
import type { NormalisedTournament } from '../../lib/normalise'
import type { EventNavigate } from './eventHelpers'
import { isUnpaid } from './paymentStatus'

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

  // replace, not push: a tab strip that stacks history entries turns the back
  // button into a section-by-section rewind instead of an exit from /manage.
  const setSection = (next: Section) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'overview') params.delete('section')
    else params.set('section', next)
    setSearchParams(params, { replace: true })
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
  const unpaid = registered.filter((r) => isUnpaid(r.paymentStatus))
  const scoredCount = matches.filter(isMatchScored).length
  const sealed = allMatchesScored(matches)
  // King of the Court records no matches (D-006), so there is nothing to score.
  const scored = !isKingOfTheCourt(tournament)

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className={`grid gap-2 ${scored ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <StatTile value={registered.length} label="Registered" />
          <StatTile
            value={unpaid.length}
            label="Unpaid"
            valueClassName={unpaid.length > 0 ? 'text-lob-danger' : ''}
          />
          {scored && (
            <StatTile
              value={matches.length > 0 ? `${scoredCount}/${matches.length}` : '—'}
              label="Scored"
            />
          )}
        </div>
        {scored && (
          <ScoringProgress scoredCount={scoredCount} total={matches.length} sealed={sealed} />
        )}
      </div>

      {/* The end-of-event sequence. Owned by RunOfShow — see workstream C.
          Rendered as an element, never as a component defined in this render
          body: a fresh function identity each pass remounts RunOfShow, which
          owns the Finish/reveal lifecycle state (appliedCount, busy, error). */}
      {isRunOfShowVisible({ phase, isAdmin: true, format: tournament.format }) && (
        <RunOfShow tournament={tournament} />
      )}
    </div>
  )
}

function ScoringProgress({
  scoredCount,
  total,
  sealed,
}: {
  scoredCount: number
  total: number
  sealed: boolean
}) {
  return (
    <div className="space-y-1.5">
      <ProgressBar value={total > 0 ? (scoredCount / total) * 100 : 0} />
      {sealed ? (
        <p className="text-xs font-semibold text-lob-teal">All matches scored</p>
      ) : (
        <p className="text-xs text-lob-muted">
          {total === 0 ? 'No schedule yet' : `${scoredCount} of ${total} matches scored`}
        </p>
      )}
    </div>
  )
}
