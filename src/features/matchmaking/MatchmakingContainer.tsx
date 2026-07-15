import { useEffect, useMemo, useRef, useState } from 'react'
import ConfigPanel from './ui/ConfigPanel'
import SchedulePreview from './ui/SchedulePreview'
import { previewSchedule, toPlayerInput } from './generateSchedule.service'
import { useCommitSchedule } from './useMatchmaking'
import { PRESET_INTENT, matcherPriorities, resolveConfig } from './domain/presets'
import { auditFeasibility } from './domain/feasibility'
import type { GenderMode, MatchConfig, ScheduleRun } from './domain/types'

type RosterRow = Parameters<typeof toPlayerInput>[0]

export type MatchmakingContainerProps = {
  tournamentId: string
  roster: RosterRow[]
  courts: number
  rounds: number
  genderMode: GenderMode
  // True when the saved schedule already has entered scores. Committing a new
  // schedule wipes them (saveMatches delete+insert), so it is gated behind a
  // typed confirmation.
  scoresEntered: boolean
}

const DEFAULT_CONFIG: MatchConfig = { preset: 'balanced' }

const CONFIRM_PHRASE = 'REGENERATE'

// A container-side seed for reshuffle/compare variety. Container is the impure
// boundary, so Math.random here is fine — the domain stays deterministic per
// the seed it receives.
const freshSeed = (): number => Math.floor(Math.random() * 0x7fffffff)

/**
 * Resolve after the browser has painted. previewSchedule is synchronous and
 * CPU-bound (~0.6–1.1s at 32 players), so without this the busy state never
 * reaches the screen: React batches it, the thread blocks, and the click looks
 * dead (M3.6 Finding 4). Two frames because the first rAF fires *before* the
 * paint that shows the spinner.
 */
const afterPaint = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })

// Wires the pure matcher domain + M3.2 commit hook into the configure →
// generate → review → save flow (D-019). All domain calls are pure; only
// commit writes.
export default function MatchmakingContainer({
  tournamentId,
  roster,
  courts,
  rounds,
  genderMode,
  scoresEntered,
}: MatchmakingContainerProps) {
  const [config, setConfig] = useState<MatchConfig>(DEFAULT_CONFIG)
  const [preview, setPreview] = useState<ScheduleRun | null>(null)
  const [compareRun, setCompareRun] = useState<ScheduleRun | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState<null | 'generate' | 'reshuffle' | 'compare'>(null)
  const [status, setStatus] = useState('')
  // Bumped whenever a run lands, to drive the scroll/announce effect. A plain
  // `preview` dep would not fire on reshuffle-to-an-identical-object.
  const [arrival, setArrival] = useState(0)
  const previewRef = useRef<HTMLDivElement>(null)

  const commit = useCommitSchedule()

  const players = useMemo(() => roster.map(toPlayerInput), [roster])
  const resolved = useMemo(
    () => resolveConfig({ config, tournamentId }),
    [config, tournamentId],
  )
  const priorities = useMemo(() => matcherPriorities({ config: resolved }), [resolved])
  const feasibility = useMemo(
    () => auditFeasibility({ players, courts, rounds, genderMode, config: resolved }),
    [players, courts, rounds, genderMode, resolved],
  )

  const generateWith = (overrides: MatchConfig): ScheduleRun =>
    previewSchedule({ tournamentId, players, courts, rounds, genderMode, config: overrides })

  // Run a synchronous domain call without freezing the click: flip the busy
  // flag, let it paint, then compute. The thread still blocks during the
  // compute itself — a worker is the escalation if the M3.6 Finding 8
  // alternatives view multiplies this cost.
  const runDeferred = async ({
    kind,
    work,
    announce,
  }: {
    kind: 'generate' | 'reshuffle' | 'compare'
    work: () => void
    announce: string
  }) => {
    if (busy) return
    setBusy(kind)
    setStatus('')
    try {
      await afterPaint()
      work()
      setStatus(announce)
      setArrival((n) => n + 1)
    } finally {
      setBusy(null)
    }
  }

  const handleGenerate = () =>
    runDeferred({
      kind: 'generate',
      work: () => {
        setCompareRun(null)
        setPreview(generateWith(config))
      },
      announce: 'Schedule generated. Review it below.',
    })

  const handleReshuffle = () =>
    runDeferred({
      kind: 'reshuffle',
      work: () => {
        setCompareRun(null)
        setPreview(generateWith({ ...config, seed: freshSeed() }))
      },
      announce: 'New schedule generated.',
    })

  const handleCompare = () =>
    runDeferred({
      kind: 'compare',
      work: () => setCompareRun(generateWith({ ...config, seed: freshSeed() })),
      announce: 'Comparison ready.',
    })

  // Bring the run into view. Without this the preview mounts below the fold and
  // the click reads as a no-op (M3.6 Finding 4).
  useEffect(() => {
    if (arrival === 0) return
    const reduceMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    previewRef.current?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    })
  }, [arrival])

  const handlePickRun = (which: 'current' | 'compare') => {
    if (which === 'compare' && compareRun) setPreview(compareRun)
    setCompareRun(null)
  }

  const doCommit = () => {
    if (!preview) return
    commit.mutate(
      { run: preview },
      {
        onSuccess: () => {
          setPreview(null)
          setConfirming(false)
          setConfirmText('')
        },
      },
    )
  }

  const handleSave = () => {
    if (!preview) return
    if (scoresEntered) {
      setConfirming(true)
      return
    }
    doCommit()
  }

  return (
    <div className="space-y-4">
      <ConfigPanel
        config={config}
        onConfigChange={setConfig}
        resolvedConfig={resolved}
        presetIntent={PRESET_INTENT[config.preset]}
        priorities={priorities}
        feasibility={feasibility}
        playerCount={players.length}
        onGenerate={handleGenerate}
        generating={busy === 'generate'}
      />

      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>

      {preview && (
        <div ref={previewRef} className="scroll-mt-4">
          <SchedulePreview
            run={preview}
            compareRun={compareRun}
            onReshuffle={handleReshuffle}
            onCompare={handleCompare}
            onPickRun={handlePickRun}
            onCancelCompare={() => setCompareRun(null)}
            onSave={handleSave}
            reshuffling={busy === 'reshuffle'}
            comparing={busy === 'compare'}
            saving={commit.isPending}
          />
        </div>
      )}

      {confirming && (
        <div className="card space-y-3 border border-red-200 bg-red-50">
          <div>
            <p className="font-semibold text-red-700 text-sm">Discard entered scores?</p>
            <p className="text-xs text-red-600 mt-0.5">
              This tournament already has scores entered. Saving a new schedule replaces every
              match and permanently discards those scores. Type{' '}
              <span className="font-mono font-bold">{CONFIRM_PHRASE}</span> to confirm.
            </p>
          </div>
          <input
            type="text"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder={CONFIRM_PHRASE}
            className="input"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={doCommit}
              disabled={confirmText !== CONFIRM_PHRASE || commit.isPending}
              className="flex-1 py-2 text-sm rounded-xl font-semibold bg-red-600 text-white disabled:opacity-50"
            >
              {commit.isPending ? 'Saving…' : 'Discard scores & save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false)
                setConfirmText('')
              }}
              disabled={commit.isPending}
              className="flex-1 py-2 text-sm rounded-xl font-semibold bg-gray-100 text-gray-600 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
