import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, CheckCircle2, Lock, Eye } from 'lucide-react'
import { useMatches } from './useMatches'
import { useEventPhase } from './useEventPhase'
import { useEventLifecycle } from './useEventLifecycle'
import { useRaffleWinners } from '../raffle/useRaffle'
import { useOscarsSession } from '../oscars/useOscarsSession'
import { runOfShowSteps, runOfShowProgress, votingTurnout } from './runOfShowSteps'
import RatingReview from '../matchmaking/ui/RatingReview'
import type { RunOfShowStep } from './runOfShowSteps'
import type { NormalisedTournament } from '../../lib/normalise'

const stepNumber = (index: number): string => String(index + 1).padStart(2, '0')

/**
 * Where a step's control lives: a plain button, an embedded component (the
 * rating review queue), or nothing (the step navigates and has no server
 * write of its own — the schedule tab owns that state).
 *
 * `link` is an optional read-only side door beside the button, for looking at
 * what the step is about to do. Rendered only while the step is actionable.
 */
type StepAction =
  | {
      kind: 'button'
      label: string
      busyLabel?: string
      busy: boolean
      onClick: () => void
      link?: { label: string; to: string }
    }
  | { kind: 'custom'; content: ReactNode }
  | null

function useStepActions({
  tournament,
  oscarsPhase,
  lifecycle,
  oscars,
}: {
  tournament: NormalisedTournament
  oscarsPhase: ReturnType<typeof useEventPhase>['oscarsPhase']
  lifecycle: ReturnType<typeof useEventLifecycle>
  oscars: ReturnType<typeof useOscarsSession>
}): Record<RunOfShowStep['id'], StepAction> {
  const navigate = useNavigate()
  const [revealingOscars, setRevealingOscars] = useState(false)

  const handleReveal = async () => {
    const ok = await lifecycle.revealResults()
    if (ok && oscarsPhase === 'ended') {
      setRevealingOscars(true)
      try {
        await oscars.shareResults()
      } finally {
        setRevealingOscars(false)
      }
    }
  }

  return {
    enter_scores: {
      kind: 'button',
      label: 'Go to Schedule',
      busy: false,
      onClick: () => navigate(`/events/${tournament.id}/schedule`),
    },
    finish: {
      kind: 'button',
      label: 'Finish tournament',
      busyLabel: 'Finishing…',
      busy: lifecycle.busy === 'finish',
      onClick: () => void lifecycle.finishTournament(),
    },
    resolve_flags: {
      kind: 'custom',
      content: (
        <RatingReview
          appliedCount={lifecycle.appliedCount ?? 0}
          queue={lifecycle.reviewQueue}
          playerNamesById={lifecycle.playerNamesById}
          onReview={lifecycle.reviewRating}
          reviewing={lifecycle.reviewing}
        />
      ),
    },
    open_voting: {
      kind: 'button',
      label: 'Go to Oscars to open voting',
      busy: false,
      onClick: () => navigate(`/events/${tournament.id}/oscars`),
    },
    close_voting: {
      kind: 'button',
      label: 'Close voting',
      busyLabel: 'Closing…',
      busy: oscars.busy,
      onClick: () => void oscars.endGame(),
    },
    reveal: {
      kind: 'button',
      label: 'Reveal the results',
      busyLabel: 'Revealing…',
      busy: lifecycle.busy === 'reveal' || revealingOscars,
      onClick: () => void handleReveal(),
      // The Results tab stays hidden until the reveal (`visibleEventTabs`), so
      // this is the admin's door to the standings beforehand. Read-only: the
      // route renders the same page, which shows admins the real ranking while
      // players still get the withheld teaser (D-029).
      link: { label: 'Preview standings', to: `/events/${tournament.id}/results` },
    },
    draw_raffle: {
      kind: 'button',
      label: 'Go draw the raffle',
      busy: false,
      onClick: () => navigate(`/events/${tournament.id}/manage?section=raffle`),
    },
    publish_raffle: {
      kind: 'button',
      label: 'Publish raffle winners',
      busyLabel: 'Publishing…',
      busy: lifecycle.busy === 'publish',
      onClick: () => void lifecycle.publishRaffleWinners(),
    },
  }
}

function StepRow({
  step,
  index,
  action,
}: {
  step: RunOfShowStep
  index: number
  action: StepAction
}) {
  const locked = step.state === 'locked'
  const done = step.state === 'done'

  return (
    <li className="card space-y-2">
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 font-mono tabular-nums text-xs font-bold text-lob-muted-light pt-0.5">
          {stepNumber(index)}
        </span>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-lob-dark text-sm">{step.title}</p>
            {done && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                <CheckCircle2 size={12} /> Done
              </span>
            )}
            {step.optional && !done && (
              <span className="text-xs font-medium text-lob-muted-light bg-gray-100 px-2 py-0.5 rounded-full">
                Optional
              </span>
            )}
          </div>
          <p className="text-xs text-lob-muted">{step.detail}</p>
          <p className="text-xs text-lob-teal-dark bg-lob-teal-light inline-flex items-center gap-1 px-2 py-0.5 rounded-full">
            <Eye size={11} /> Players see: {step.playersSee}
          </p>

          {locked && step.lockedReason && (
            <p className="flex items-center gap-1.5 text-xs text-lob-muted-light">
              <Lock size={12} /> {step.lockedReason}
            </p>
          )}

          {!done && action && (
            <div className="pt-1">
              {action.kind === 'custom' ? (
                locked ? null : (
                  action.content
                )
              ) : (
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={action.onClick}
                    disabled={locked || action.busy}
                    className="btn-secondary py-2 px-4 text-xs disabled:opacity-50"
                  >
                    {action.busy ? (action.busyLabel ?? action.label) : action.label}
                  </button>
                  {/* Hidden while locked — there is nothing to look at yet. */}
                  {action.link && !locked && (
                    <Link
                      to={action.link.to}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-lob-teal underline underline-offset-2 decoration-lob-teal/40"
                    >
                      <ArrowUpRight size={12} /> {action.link.label}
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

export default function RunOfShow({ tournament }: { tournament: NormalisedTournament }) {
  const { data: matches = [] } = useMatches(tournament.id)
  const { oscarsPhase } = useEventPhase(tournament)
  const { data: raffleWinners = [] } = useRaffleWinners(tournament.id)
  const lifecycle = useEventLifecycle({ tournament })
  const oscars = useOscarsSession(tournament)

  const sessionId = oscars.session?.id
  useEffect(() => {
    if (sessionId) oscars.loadAdminStats()
    // Fires once per session — loadAdminStats is stable within a render but
    // re-creating it every render must not re-trigger the fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const turnout = votingTurnout(oscars.adminStats)

  const steps = runOfShowSteps({
    tournament,
    matches,
    oscarsPhase,
    flaggedCount: lifecycle.reviewQueue.length,
    hasRaffleWinners: raffleWinners.length > 0,
    turnout,
  })
  const progress = runOfShowProgress(steps)
  const actions = useStepActions({ tournament, oscarsPhase, lifecycle, oscars })

  return (
    <div className="card space-y-4" data-testid="run-of-show">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lob-dark">Run of show</h2>
        <span className="text-xs font-semibold text-lob-muted">
          {progress.done} of {progress.total} done
        </span>
      </div>

      {lifecycle.error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
          {lifecycle.error}
        </p>
      )}

      <ol className="space-y-3">
        {steps.map((step, i) => (
          <StepRow key={step.id} step={step} index={i} action={actions[step.id]} />
        ))}
      </ol>
    </div>
  )
}
