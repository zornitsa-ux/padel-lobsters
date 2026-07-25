import { useState } from 'react'
import { ChevronDown, ChevronRight, CheckCircle2, Minus, Plus } from 'lucide-react'
import type { RatingEventRow } from '../matchmakingSchemas'
import { describeRatingRecommendation } from './ratingRecommendation'
import { playerName, type PlayerNamesById } from './playerNames'

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
      <div className="mt-1 text-[11px] uppercase tracking-wide text-lob-muted leading-none">
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
        <div className="font-mono tabular-nums text-sm font-semibold text-lob-amber leading-none">
          {formatLevel(cautious)}
        </div>
        <div className="mt-1 text-[11px] uppercase tracking-wide text-lob-muted leading-none">
          now
        </div>
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
    strong: 'bg-green-50 border-green-200 text-green-800',
    moderate: 'bg-lob-teal-light border-lob-teal/20 text-lob-teal-dark',
    mixed: 'bg-amber-50 border-amber-200 text-amber-800',
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
    <li className="grid grid-cols-[1fr_auto] gap-x-3 text-xs border-t border-gray-100 pt-2 first:border-t-0 first:pt-0">
      <span className="text-gray-600">
        Round {row.round} · with {partnerName} vs {opponentNames}
      </span>
      <span className="self-start text-right font-mono tabular-nums font-medium text-gray-700 whitespace-nowrap">
        {formatSigned({ value: row.delta })}
      </span>
      <span className="col-start-1 mt-0.5 text-gray-400">
        Predicted {(row.expectedShare * 100).toFixed(0)}% of points · won{' '}
        {(row.actualShare * 100).toFixed(0)}%
      </span>
    </li>
  )
}

type Mode = 'cautious' | 'custom' | 'full'

function ModeButton({
  active,
  disabled,
  onClick,
  title,
  sub,
}: {
  active: boolean
  disabled: boolean
  onClick: () => void
  title: string
  sub: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`flex-1 px-2 py-2 text-center border-r last:border-r-0 border-gray-200 transition-colors disabled:opacity-50 ${
        active ? 'bg-lob-coral text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
      }`}
    >
      <span className="block text-sm font-semibold">{title}</span>
      <span
        className={`block font-mono tabular-nums text-xs ${active ? 'text-white/85' : 'text-gray-400'}`}
      >
        {sub}
      </span>
    </button>
  )
}

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
        <p className="font-semibold text-gray-700">{playerDisplayName}</p>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700 whitespace-nowrap">
          Needs review
        </span>
      </div>

      <LevelLine before={before} cautious={cautiousLevel} full={fullLevel} direction={direction} />

      <p className="text-xs text-gray-500">
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
        <div className="flex rounded-xl border border-gray-200 overflow-hidden">
          <ModeButton
            active={mode === 'cautious'}
            disabled={reviewing}
            onClick={() => setMode('cautious')}
            title="Keep cautious"
            sub={formatLevel(cautiousLevel)}
          />
          <ModeButton
            active={mode === 'custom'}
            disabled={reviewing}
            onClick={() => setMode('custom')}
            title="Custom"
            sub={`${formatLevel(loLevel)}–${formatLevel(hiLevel)}`}
          />
          <ModeButton
            active={mode === 'full'}
            disabled={reviewing}
            onClick={() => setMode('full')}
            title="Apply full"
            sub={formatLevel(fullLevel)}
          />
        </div>

        {mode === 'custom' && (
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => nudgeCustom(-1)}
              disabled={reviewing || customTarget <= loLevel + 1e-9}
              aria-label="Lower target level"
              className="w-10 h-10 grid place-items-center rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50"
            >
              <Minus size={18} />
            </button>
            <span className="font-mono tabular-nums text-xl font-semibold text-lob-dark w-16 text-center">
              {formatLevel(customTarget)}
            </span>
            <button
              type="button"
              onClick={() => nudgeCustom(1)}
              disabled={reviewing || customTarget >= hiLevel - 1e-9}
              aria-label="Raise target level"
              className="w-10 h-10 grid place-items-center rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50"
            >
              <Plus size={18} />
            </button>
            <span className="text-xs text-gray-400">
              between {formatLevel(loLevel)} and {formatLevel(hiLevel)}
            </span>
          </div>
        )}
      </div>

      {row.breakdown.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setBreakdownOpen((open) => !open)}
            className="flex items-center gap-1 text-sm font-semibold text-lob-teal"
          >
            {breakdownOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            See the {row.breakdown.length} matches behind this
          </button>
          {breakdownOpen && (
            <>
              <p className="mt-1.5 text-xs text-gray-400">
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
        <button type="button" onClick={confirm} disabled={reviewing} className="btn-primary">
          {confirmLabel}
        </button>
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
        <p className="text-sm text-gray-600">
          {appliedCount} adjustment{appliedCount === 1 ? '' : 's'} auto-applied.
        </p>
      )}

      {queue.length === 0 && (
        <div className="card flex items-center gap-2 text-sm text-green-700 bg-green-50">
          <CheckCircle2 size={18} />
          All adjustments auto-applied — nothing to review.
        </div>
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
