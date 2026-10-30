import React from 'react'
import { Modal } from '../../components/ui/Modal'
import { REVIEW_SCENARIOS } from './reviewScenarios'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'

// One message variant plus how many players receive it.
export interface ReviewSample {
  text: string
  count: number
}

// A scenario bucket built by AdminTools: who lands in it and which message
// variants fired. `samples` is keyed by message text.
export interface ReviewBucket {
  id: string
  label: string
  players: { id: string | number; name?: string | null }[]
  samples: Map<string, ReviewSample>
}

interface ReviewBreakdownModalProps {
  reviewBreakdown: ReviewBucket[]
  onClose: () => void
}

export default function ReviewBreakdownModal({
  reviewBreakdown,
  onClose,
}: ReviewBreakdownModalProps) {
  const PERF_IDS = new Set(REVIEW_SCENARIOS.filter((s) => s.performance).map((s) => s.id))
  const perfBuckets = reviewBreakdown.filter((b) => PERF_IDS.has(b.id))
  const otherBuckets = reviewBreakdown.filter((b) => !PERF_IDS.has(b.id))
  const perfPlayers = perfBuckets.reduce((n, b) => n + b.players.length, 0)
  const perfFiring = perfBuckets.length

  const renderBucket = (b: ReviewBucket, accent: 'perf' | 'hist' | 'generic') => (
    <div
      key={b.id}
      className={`rounded-2xl border-2 px-3 py-3 ${
        accent === 'perf'
          ? 'bg-lob-warning-light border-lob-warning-border'
          : accent === 'hist'
            ? 'bg-teal-50 border-teal-200'
            : 'bg-lob-well border-lob-line-strong'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p
          className={`text-xs font-bold ${
            accent === 'perf'
              ? 'text-lob-warning-strong'
              : accent === 'hist'
                ? 'text-teal-700'
                : 'text-lob-muted'
          }`}
        >
          {b.label}
        </p>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            accent === 'perf'
              ? 'bg-lob-warning-solid text-white'
              : accent === 'hist'
                ? 'bg-teal-500 text-white'
                : 'bg-gray-200 text-lob-slate'
          }`}
        >
          {b.players.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-1 mb-2">
        {b.players.map((p) => (
          <span
            key={p.id}
            className="text-xs bg-white border border-lob-line-strong px-2 py-0.5 rounded-md text-lob-slate"
          >
            {(p.name || '').split(' ')[0]}
          </span>
        ))}
      </div>
      <div className="space-y-1.5">
        {[...b.samples.values()].map((s, i) => (
          <details key={i} className="text-xs">
            <summary className="cursor-pointer text-lob-muted font-semibold">
              {b.samples.size > 1
                ? `Variant ${i + 1} (${s.count} player${s.count > 1 ? 's' : ''})`
                : 'Show message'}
            </summary>
            <p className="mt-1 italic text-lob-slate leading-relaxed">"{s.text}"</p>
          </details>
        ))}
      </div>
    </div>
  )

  return (
    <Modal
      open
      onClose={onClose}
      title="Review breakdown"
      footer={
        <Button onClick={onClose} fullWidth>
          Close
        </Button>
      }
    >
      <p className="text-xs text-lob-muted-light -mt-2 mb-3">
        Who's getting which Lobster Review, grouped by scenario
      </p>

      {/* Performance summary banner */}
      <div className="-mx-5 px-5 py-3 bg-lob-warning-light border-y border-lob-warning-border mb-3">
        <p className="text-xs font-bold text-lob-warning-strong uppercase tracking-wide mb-1">
          ⭐ Performance messages
        </p>
        <p className="text-xs text-lob-warning">
          <strong>{perfFiring} of 10</strong> performance scenarios firing, reaching{' '}
          <strong>{perfPlayers}</strong> player{perfPlayers === 1 ? '' : 's'}. Everyone else gets
          historical, welcome, or generic level-based reviews.
        </p>
      </div>

      <div className="space-y-3">
        {/* Performance scenarios first */}
        {perfBuckets.length > 0 && (
          <div className="space-y-2">{perfBuckets.map((b) => renderBucket(b, 'perf'))}</div>
        )}

        {/* Other scenarios (historical + filler) */}
        {otherBuckets.length > 0 && (
          <>
            <p className="text-2xs font-bold text-lob-muted-light uppercase tracking-wider mt-2 px-1">
              Other scenarios
            </p>
            <div className="space-y-2">
              {otherBuckets.map((b) => {
                const isHist = b.id.startsWith('hist-')
                return renderBucket(b, isHist ? 'hist' : 'generic')
              })}
            </div>
          </>
        )}

        {reviewBreakdown.length === 0 && (
          <EmptyState variant="inline" title="No reviews to break down yet." />
        )}
      </div>
    </Modal>
  )
}
