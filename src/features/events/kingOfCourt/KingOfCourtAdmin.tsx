import { useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { IconButton } from '../../../components/ui/IconButton'
import { useConfirm } from '../../../lib/confirmBus'
import { formatDate } from '../eventHelpers'
import { isEventDayReached } from '../../../lib/tournamentDate'
import { rankFromFinalCourts } from './domain'
import {
  finalRankUpdates,
  hasRepeatedTeam,
  savedCourtResults,
  moveTeam,
  seedUpdates,
} from './kotcAdmin'
import StartingCourtsList from './StartingCourtsList'
import { courtLabel } from './kotcPlayer'
import { useKingOfCourtActions, useKingOfCourtSeeding } from './useKingOfCourtAdmin'
import type { CourtResult } from './domain'
import type { NormalisedTournament } from '../../../lib/normalise'
import { Button } from '../../../components/ui/Button'
import { AlertBox } from '../../../components/ui/AlertBox'
import { FormError } from '../../../components/ui/FormError'

// Shown on the event day, so the time matters more than the date.
const shownAt = (iso: string) =>
  `${formatDate(iso)}, ${new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`

type Seeding = ReturnType<typeof useKingOfCourtSeeding>
type Actions = ReturnType<typeof useKingOfCourtActions>

// DESIGN §3.3: seed, show starting court assignments to players, then (optionally)
// final standings.
export default function KingOfCourtAdmin({ tournament }: { tournament: NormalisedTournament }) {
  const seeding = useKingOfCourtSeeding({ tournament })
  const actions = useKingOfCourtActions({ tournamentId: tournament.id })

  return (
    <div className="space-y-4" data-testid="kotc-admin">
      {actions.error && (
        <AlertBox variant="error" size="sm">
          {actions.error}
        </AlertBox>
      )}
      <SeedsCard tournament={tournament} seeding={seeding} actions={actions} />
      {isEventDayReached({ date: tournament.date }) && seeding.order.length > 0 && (
        <FinalStandingsCard seeding={seeding} actions={actions} />
      )}
    </div>
  )
}

function SeedsCard({
  tournament,
  seeding,
  actions,
}: {
  tournament: NormalisedTournament
  seeding: Seeding
  actions: Actions
}) {
  const confirm = useConfirm()
  const { order, setOrder, teams, labelOf, strengthById, layout } = seeding
  const patches = seedUpdates({ order, teams })
  const publishedAt = tournament.startingCourtsPublishedAt

  const save = async () => {
    if (await actions.saveSeeds({ patches })) setOrder(null)
  }

  const publish = async () => {
    const ok = await confirm({
      title: 'Show starting court assignments to players?',
      message:
        'Players will see which court their team starts on. You can still reorder afterwards; they see each saved change.',
      confirmLabel: 'Show to players',
    })
    if (ok && (await actions.publish({ patches }))) setOrder(null)
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold text-lob-dark">Seeds and starting courts</h2>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            publishedAt ? 'bg-lob-success-light text-lob-success' : 'bg-gray-100 text-lob-muted'
          }`}
        >
          {publishedAt ? 'Shown to players' : 'Not shown yet'}
        </span>
      </div>
      <p className="text-xs text-lob-muted">
        {publishedAt
          ? `Shown to players since ${shownAt(publishedAt)}. They see the saved order.`
          : 'Strongest team first, by average Playtomic level. Reorder if needed, then show the assignments to players, usually a couple of hours before the start.'}
      </p>

      {order.length === 0 ? (
        <p className="text-sm text-lob-muted">No registered teams yet.</p>
      ) : (
        <>
          <ol className="divide-y divide-lob-line">
            {order.map((teamId, index) => {
              const strength = strengthById.get(teamId)
              return (
                <li key={teamId} className="flex items-center gap-2 py-2">
                  <span className="w-5 font-mono tabular-nums text-xs font-bold text-lob-muted">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-lob-dark truncate">{labelOf(teamId)}</p>
                    {strength && (
                      <p className="text-xs text-lob-muted">
                        Avg level {strength.strength.toFixed(2)}
                        {strength.unrated && (
                          <span className="ml-1 text-lob-warning bg-lob-warning-light px-1.5 rounded-full">
                            unrated
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <IconButton
                    variant="ghost"
                    size="sm"
                    aria-label={`Move ${labelOf(teamId)} up`}
                    disabled={index === 0}
                    onClick={() => setOrder(moveTeam({ order, index, delta: -1 }))}
                  >
                    <ArrowUp />
                  </IconButton>
                  <IconButton
                    variant="ghost"
                    size="sm"
                    aria-label={`Move ${labelOf(teamId)} down`}
                    disabled={index === order.length - 1}
                    onClick={() => setOrder(moveTeam({ order, index, delta: 1 }))}
                  >
                    <ArrowDown />
                  </IconButton>
                </li>
              )
            })}
          </ol>

          <StartingCourtsList
            courts={layout.courts}
            overflowTeamIds={layout.overflowTeamIds}
            order={order}
            labelOf={labelOf}
            overflowAction="Add a court or cancel a team."
          />

          <div className="flex gap-2 flex-wrap">
            {!publishedAt && (
              <Button fullWidth disabled={actions.busy != null} onClick={() => void publish()}>
                {actions.busy === 'publish'
                  ? 'Showing…'
                  : 'Show starting court assignments to players'}
              </Button>
            )}
            {/* Before they're shown, Show saves the order. Saving earlier would pin
                today's teams above stronger teams that sign up later. */}
            {publishedAt && patches.length > 0 && (
              <Button
                variant="secondary"
                disabled={actions.busy != null}
                onClick={() => void save()}
              >
                {actions.busy === 'seeds' ? 'Saving…' : 'Save order'}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function FinalStandingsCard({ seeding, actions }: { seeding: Seeding; actions: Actions }) {
  const { order, teams, labelOf, layout } = seeding
  const [draft, setDraft] = useState<CourtResult[] | null>(null)
  const saved = savedCourtResults({ teams, courtCount: layout.courts.length })
  // Per court, so a court added after editing started is still editable.
  const results = saved.map((result, k) => draft?.[k] ?? result)
  const repeated = hasRepeatedTeam({ courtResults: results })
  const patches = repeated
    ? []
    : finalRankUpdates({ ranks: rankFromFinalCourts({ courtResults: results }), teams })

  const pick = ({
    court,
    slot,
    teamId,
  }: {
    court: number
    slot: keyof CourtResult
    teamId: string
  }) => setDraft(results.map((r, k) => (k === court ? { ...r, [slot]: teamId || null } : r)))

  const save = async () => {
    if (await actions.saveStandings({ patches })) setDraft(null)
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold text-lob-dark">Final standings</h2>
        <span className="text-xs font-medium text-lob-muted-light bg-gray-100 px-2 py-0.5 rounded-full">
          Optional
        </span>
      </div>
      <p className="text-xs text-lob-muted">
        Who finished 1st and 2nd on each court. Fill in as much as you know; the rest stay unranked.
        Players see the ranking as soon as you save.
      </p>

      <ol className="space-y-3">
        {layout.courts.map((court, k) => (
          <li key={court.courtIndex} className="space-y-1">
            <p className="text-xs font-bold text-lob-teal">{courtLabel({ court })}</p>
            {(['first', 'second'] as const).map((slot) => (
              <label key={slot} className="flex items-center gap-2 text-xs text-lob-muted">
                <span className="w-8">{slot === 'first' ? '1st' : '2nd'}</span>
                <select
                  className="input flex-1 min-w-0 py-1.5 text-sm"
                  value={results[k]?.[slot] ?? ''}
                  onChange={(e) => pick({ court: k, slot, teamId: e.target.value })}
                >
                  <option value="">Not recorded</option>
                  {order.map((teamId) => (
                    <option key={teamId} value={teamId}>
                      {labelOf(teamId)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </li>
        ))}
      </ol>

      <FormError message={repeated ? 'A team is picked more than once.' : ''} polite />

      <div className="flex gap-2 flex-wrap">
        <Button
          disabled={repeated || patches.length === 0 || actions.busy != null}
          onClick={() => void save()}
        >
          {actions.busy === 'standings' ? 'Saving…' : 'Save standings'}
        </Button>
        <Button
          variant="secondary"
          disabled={actions.busy != null}
          onClick={() => setDraft(layout.courts.map(() => ({ first: null, second: null })))}
        >
          Clear all
        </Button>
      </div>
    </div>
  )
}
