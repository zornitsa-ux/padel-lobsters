import { useState } from 'react'
import { CheckCircle2, Minus, Plus } from 'lucide-react'
import type { RatingEventRow } from '../matchmakingSchemas'
import { describeRatingRecommendation } from './ratingRecommendation'
import { playerName, type PlayerNamesById } from './playerNames'
import { Button } from '../../../components/ui/Button'
import { IconButton } from '../../../components/ui/IconButton'
import { Disclosure } from '../../../components/ui/Disclosure'
import { SegmentedControl } from '../../../components/ui/SegmentedControl'
import { AlertBox } from '../../../components/ui/AlertBox'
import { Badge } from '../../../components/ui/Badge'

export type RatingReviewProps = {
  // Count of adjustments auto-applied without review (small, within-cap moves).
  appliedCount: number
  // Flagged events awaiting review (clamped/large moves). Empty = nothing to review.
  queue: RatingEventRow[]
  // Display names for player_id and for partnerId/opponentIds inside breakdowns.
  playerNamesById: PlayerNamesById
  onReview: (args: {
    eventId: string
    action: 'approve' | 'edit' | 'discard'
    delta?: number
  }) => void
  // A review mutation is in flight (disable buttons).
  reviewing: boolean
}

const STEP = 0.05

const formatLevel = (value: number): string => value.toFixed(2)

function formatSigned({ value, digits = 2 }: { value: number; digits?: number }): string {
  const rounded = value.toFixed(digits)
  return value >= 0 ? `+${rounded}` : rounded
}

const roundToStep = (value: number): number => Math.round(value / STEP) * STEP
const clamp = ({ value, lo, hi }: { value: number; lo: number; hi: number }): number =>
  Math.min(hi, Math.max(lo, value))

// Before / now / results, drawn low-to-high left-to-right regardless of whether
// the move is a drop or a raise; the "before" and "results" labels carry the
// direction. Coral line for a drop, teal for a raise.
function LevelLine({
  before,
  cautious,
  full,
  direction,
}: {
  before: number
  cautious: number
  full: number
  direction: 'up' | 'down'
}) {
  const lo = Math.min(before, full)
  const hi = Math.max(before, full)
  const range = hi - lo
  const track = (value: number): number => (range > 0 ? 10 + ((value - lo) / range) * 80 : 50)
  const nowPos = track(cautious)

  const lineColor =
    direction === 'up'
      ? 'linear-gradient(90deg, #E8A030, #3D7A8A)'
      : 'linear-gradient(90deg, #D94F2B, #E8A030)'

  const results = { value: full, caption: 'results say' }
  const start = { value: before, caption: 'before' }
  const left = direction === 'down' ? results : start
  const right = direction === 'down' ? start : results

  // Three vertical bands (px, no overlap): endpoint labels 0–30 · bar 48 ·
  // now label 66–92. Dots are centered on the bar (center 51).
  const Endpoint = ({
    value,
    caption,
    align,
  }: {
    value: number
    caption: string
    align: 'left' | 'right'
  }) => (
    <div
      className={`absolute top-0 ${align === 'left' ? 'text-left left-0' : 'text-right right-0'}`}
      style={{ maxWidth: '40%' }}
    >
      <div className="font-mono tabular-nums text-sm font-semibold text-lob-dark leading-none">
        {formatLevel(value)}
      </div>
      <div className="mt-1 text-xs uppercase tracking-wide text-lob-muted leading-none">
        {caption}
      </div>
    </div>
  )

  const dot = (pos: number, size: number, color: string) => (
    <span
      className="absolute rounded-full bg-white -translate-x-1/2"
      style={{
        left: `${pos}%`,
        top: `${51 - size / 2}px`,
        width: size,
        height: size,
        boxShadow: `0 0 0 3px ${color}`,
      }}
      aria-hidden
    />
  )

  return (
    <div className="relative my-2" style={{ height: '96px' }}>
      <div
        className="absolute rounded-full"
        style={{ left: '10%', right: '10%', top: '48px', height: '6px', background: lineColor }}
        aria-hidden
      />
      {dot(track(before), 12, '#6B8A92')}
      {dot(nowPos, 14, '#E8A030')}
      {dot(track(full), 12, direction === 'up' ? '#3D7A8A' : '#D94F2B')}
      <Endpoint value={left.value} caption={left.caption} align="left" />
      <Endpoint value={right.value} caption={right.caption} align="right" />
      <div
        className="absolute text-center -translate-x-1/2 whitespace-nowrap"
        style={{ left: `${nowPos}%`, top: '66px' }}
      >
        <div className="font-mono tabular-nums text-sm font-semibold text-lob-amber-strong leading-none">
          {formatLevel(cautious)}
        </div>
        <div className="mt-1 text-xs uppercase tracking-wide text-lob-muted leading-none">now</div>
      </div>
    </div>
  )
}

function Recommendation({
  tone,
  headline,
  evidence,
}: {
  tone: 'strong' | 'moderate' | 'mixed'
  headline: string
  evidence: string[]
}) {
  const styles = {
    strong: 'bg-lob-success-light border-lob-success-border text-lob-success-strong',
    moderate: 'bg-lob-teal-light border-lob-teal/20 text-lob-teal-dark',
    mixed: 'bg-lob-warning-light border-lob-warning-border text-lob-warning-strong',
  }[tone]

  return (
    <div className={`rounded-xl border px-3.5 py-3 text-sm ${styles}`}>
      <p className="font-medium">{headline}</p>
      {evidence.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {evidence.map((line) => (
            <span
              key={line}
              className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs text-lob-dark"
            >
              {line}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function BreakdownRow({
  row,
  playerNamesById,
}: {
  row: RatingEventRow['breakdown'][number]
  playerNamesById: PlayerNamesById
}) {
  const partnerName = playerName({ id: row.partnerId, playerNamesById })
  const opponentNames = row.opponentIds.map((id) => playerName({ id, playerNamesById })).join(' & ')

  return (
    <li className="grid grid-cols-[1fr_auto] gap-x-3 text-xs border-t border-lob-line pt-2 first:border-t-0 first:pt-0">
      <span className="text-lob-slate">
        Round {row.round} · with {partnerName} vs {opponentNames}
      </span>
      <span className="self-start text-right font-mono tabular-nums font-medium text-lob-slate whitespace-nowrap">
        {formatSigned({ value: row.delta })}
      </span>
      <span className="col-start-1 mt-0.5 text-lob-muted-light">
        Predicted {(row.expectedShare * 100).toFixed(0)}% of points · won{' '}
        {(row.actualShare * 100).toFixed(0)}%
      </span>
    </li>
  )
}

type Mode = 'cautious' | 'custom' | 'full'

const levelDetail = (text: string) => <span className="font-mono tabular-nums">{text}</span>

function QueueCard({
  row,
  playerNamesById,
  onReview,
  reviewing,
}: {
  row: RatingEventRow
  playerNamesById: PlayerNamesById
  onReview: RatingReviewProps['onReview']
  reviewing: boolean
}) {
  const playerDisplayName = playerName({ id: row.player_id, playerNamesById })
  const before = row.prior_mu
  const cautiousLevel = row.prior_mu + row.applied_delta
  const fullLevel = row.prior_mu + row.proposed_delta
  const direction: 'up' | 'down' = row.proposed_delta >= 0 ? 'up' : 'down'
  const remainder = row.proposed_delta - row.applied_delta

  const loLevel = Math.min(cautiousLevel, fullLevel)
  const hiLevel = Math.max(cautiousLevel, fullLevel)

  const rec = describeRatingRecommendation({
    breakdown: row.breakdown,
    proposedDelta: row.proposed_delta,
    fullLevel,
    cautiousLevel,
  })

  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [mode, setMode] = useState<Mode>(rec.recommendedMode)
  const [customTarget, setCustomTarget] = useState<number>(
    clamp({ value: roundToStep((cautiousLevel + fullLevel) / 2), lo: loLevel, hi: hiLevel }),
  )

  const nudgeCustom = (deltaSteps: number) =>
    setCustomTarget((target) =>
      clamp({ value: roundToStep(target + deltaSteps * STEP), lo: loLevel, hi: hiLevel }),
    )

  const confirm = () => {
    if (mode === 'cautious') {
      onReview({ eventId: row.id, action: 'discard' })
    } else if (mode === 'full') {
      onReview({ eventId: row.id, action: 'approve' })
    } else {
      const delta = Number((customTarget - cautiousLevel).toFixed(2))
      onReview({ eventId: row.id, action: 'edit', delta })
    }
  }

  const confirmLabel =
    mode === 'cautious'
      ? `Keep at ${formatLevel(cautiousLevel)}`
      : mode === 'full'
        ? `Apply full move to ${formatLevel(fullLevel)}`
        : `Set level to ${formatLevel(customTarget)}`

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-lob-slate">{playerDisplayName}</p>
        <Badge tone="warning" label="Needs review" />
      </div>

      <LevelLine before={before} cautious={cautiousLevel} full={fullLevel} direction={direction} />

      <p className="text-xs text-lob-muted">
        Already {direction === 'down' ? 'lowered' : 'raised'} to{' '}
        <span className="font-mono tabular-nums">{formatLevel(cautiousLevel)}</span> (the most we
        change in one night). The last{' '}
        <span className="font-mono tabular-nums">{formatSigned({ value: remainder })}</span> is your
        call.
      </p>

      <Recommendation tone={rec.tone} headline={rec.headline} evidence={rec.evidence} />

      <div>
        <p className="text-xs font-semibold text-lob-muted uppercase tracking-wide mb-1.5">
          Set {playerDisplayName}&apos;s level
        </p>
        <SegmentedControl<Mode>
          ariaLabel="Level to set"
          disabled={reviewing}
          options={[
            {
              value: 'cautious',
              label: 'Keep cautious',
              detail: levelDetail(formatLevel(cautiousLevel)),
            },
            {
              value: 'custom',
              label: 'Custom',
              detail: levelDetail(`${formatLevel(loLevel)}–${formatLevel(hiLevel)}`),
            },
            { value: 'full', label: 'Apply full', detail: levelDetail(formatLevel(fullLevel)) },
          ]}
          value={mode}
          onChange={setMode}
        />

        {mode === 'custom' && (
          <div className="mt-3 flex items-center gap-3">
            <IconButton
              onClick={() => nudgeCustom(-1)}
              disabled={reviewing || customTarget <= loLevel + 1e-9}
              aria-label="Lower target level"
            >
              <Minus />
            </IconButton>
            <span className="font-mono tabular-nums text-xl font-semibold text-lob-dark w-16 text-center">
              {formatLevel(customTarget)}
            </span>
            <IconButton
              onClick={() => nudgeCustom(1)}
              disabled={reviewing || customTarget >= hiLevel - 1e-9}
              aria-label="Raise target level"
            >
              <Plus />
            </IconButton>
            <span className="text-xs text-lob-muted-light">
              between {formatLevel(loLevel)} and {formatLevel(hiLevel)}
            </span>
          </div>
        )}
      </div>

      {row.breakdown.length > 0 && (
        <div>
          <Disclosure expanded={breakdownOpen} onToggle={() => setBreakdownOpen((open) => !open)}>
            See the {row.breakdown.length} matches behind this
          </Disclosure>
          {breakdownOpen && (
            <>
              <p className="mt-1.5 text-xs text-lob-muted-light">
                Each match nudges the level by the amount on the right; they add up to the full
                move.
              </p>
              <ul className="mt-2 space-y-2">
                {row.breakdown.map((breakdownRow) => (
                  <BreakdownRow
                    key={breakdownRow.matchId}
                    row={breakdownRow}
                    playerNamesById={playerNamesById}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="pt-1">
        <Button onClick={confirm} disabled={reviewing}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  )
}

export default function RatingReview({
  appliedCount,
  queue,
  playerNamesById,
  onReview,
  reviewing,
}: RatingReviewProps) {
  return (
    <div className="space-y-3">
      {appliedCount > 0 && (
        <p className="text-sm text-lob-slate">
          {appliedCount} adjustment{appliedCount === 1 ? '' : 's'} auto-applied.
        </p>
      )}

      {queue.length === 0 && (
        <AlertBox variant="success" icon={<CheckCircle2 />}>
          All adjustments auto-applied — nothing to review.
        </AlertBox>
      )}

      {queue.map((row) => (
        <QueueCard
          key={row.id}
          row={row}
          playerNamesById={playerNamesById}
          onReview={onReview}
          reviewing={reviewing}
        />
      ))}
    </div>
  )
}
