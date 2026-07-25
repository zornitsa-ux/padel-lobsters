import { useEffect, useMemo, useRef, useState } from 'react'
import ConfigPanel from './ui/ConfigPanel'
import SchedulePreview from './ui/SchedulePreview'
import CompareView from './ui/CompareView'
import RematchFixPanel from './ui/RematchFixPanel'
import { previewSchedule, toPlayerInput } from './generateSchedule.service'
import { useCommitSchedule } from './useMatchmaking'
import { useConfigDerivations } from './useConfigDerivations'
import { suggestOpponentSwaps } from './domain/swaps'
import type { SwapSuggestion } from './domain/swaps'
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

const FAILURE_MESSAGE = {
  generate: 'Could not generate a schedule. Check the court and player setup, then try again.',
  alt: 'Could not generate the alternative. Try again, or close and keep the original.',
  fix: 'Could not work out fix options for that pair. Try again.',
} as const

// The matches write lands before the audit-run write and they are deliberately
// not one transaction (D-016), so a failure here may be partial — the copy must
// not promise that nothing changed.
const SAVE_FAILURE_MESSAGE =
  'Could not finish saving the schedule. Reload to check what was saved before trying again.'

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
  const [confirming, setConfirming] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState<null | 'generate' | 'alt' | 'fix'>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Bumped whenever a run lands, to drive the scroll/announce effect. A plain
  // `preview` dep would not fire on reshuffle-to-an-identical-object.
  const [arrival, setArrival] = useState(0)
  const previewRef = useRef<HTMLDivElement>(null)

  // Compare → Alternatives overlay session state (D-023 Resolution / M3.7).
  const [comparing, setComparing] = useState(false)
  const [altConfig, setAltConfig] = useState<MatchConfig>(DEFAULT_CONFIG)
  const [altRun, setAltRun] = useState<ScheduleRun | null>(null)

  // Manual opponent-swap ("Fix" repeat) session state (D-026 / M3.8). Cleared
  // whenever the preview changes so a stale target never lingers.
  const [fixing, setFixing] = useState<{
    roundIndex: number
    pair: [string, string]
    suggestions: SwapSuggestion[]
  } | null>(null)

  const commit = useCommitSchedule()

  const players = useMemo(() => roster.map(toPlayerInput), [roster])

  const playerNamesById = useMemo(
    () => Object.fromEntries(players.map((p) => [p.playerId, p.name])),
    [players],
  )

  const { resolved, priorities, feasibility, presetIntent } = useConfigDerivations({
    config,
    players,
    courts,
    rounds,
    genderMode,
    tournamentId,
  })

  const altDerivations = useConfigDerivations({
    config: altConfig,
    players,
    courts,
    rounds,
    genderMode,
    tournamentId,
  })

  const generateWith = (overrides: MatchConfig): ScheduleRun =>
    previewSchedule({ tournamentId, players, courts, rounds, genderMode, config: overrides })

  // Run a synchronous domain call without freezing the click: flip the busy
  // flag, let it paint, then compute. The thread still blocks during the
  // compute itself — a worker is the escalation if the alternatives view
  // multiplies this cost.
  const runDeferred = async ({
    kind,
    work,
    announce,
    scroll = true,
  }: {
    kind: 'generate' | 'alt' | 'fix'
    work: () => void
    announce: string
    // Bump `arrival` to scroll the new run into view. Off for 'fix': its result
    // is a viewport-anchored overlay, and scrolling away from the chip the admin
    // just clicked is disorienting (D-023 Resolution — auto-scroll rejected).
    scroll?: boolean
  }) => {
    if (busy) return
    setBusy(kind)
    setStatus('')
    setError(null)
    try {
      await afterPaint()
      work()
      setStatus(announce)
      if (scroll) setArrival((n) => n + 1)
    } catch (cause) {
      // Without this the throw escapes as an unhandled rejection: busy clears,
      // nothing renders, and the click is indistinguishable from a dead button.
      console.error(`matchmaking ${kind} failed:`, cause)
      setError(FAILURE_MESSAGE[kind])
    } finally {
      setBusy(null)
    }
  }

  const handleGenerate = () =>
    runDeferred({
      kind: 'generate',
      work: () => setPreview(generateWith(config)),
      announce: 'Schedule generated. Review it below.',
    })

  // Open the overlay seeded with the current config, but do NOT generate an
  // alternative — the admin chooses the settings and generates it themselves.
  const handleOpenCompare = () => {
    setAltConfig(config)
    setAltRun(null)
    setComparing(true)
  }

  const handleGenerateAlt = () =>
    runDeferred({
      kind: 'alt',
      work: () => setAltRun(generateWith({ ...altConfig, seed: freshSeed() })),
      announce: 'Alternative ready.',
    })

  const handleUseAlternative = () => {
    if (altRun) setPreview(altRun)
    setComparing(false)
    setAltRun(null)
  }

  const handleCloseCompare = () => {
    setComparing(false)
    setAltRun(null)
  }

  // Compute ranked swap suggestions for one repeat chip (D-026). Deferred
  // through the same runDeferred pattern as generate/alt so the click stays
  // responsive even though suggestOpponentSwaps rebuilds a run per candidate.
  const handleFixRematch = ({ roundIndex, pair }: { roundIndex: number; pair: [string, string] }) =>
    runDeferred({
      kind: 'fix',
      work: () => {
        if (!preview) return
        const suggestions = suggestOpponentSwaps({
          run: preview,
          players,
          genderMode,
          feasibility,
          roundIndex,
          pair,
        })
        setFixing({ roundIndex, pair, suggestions })
      },
      announce: 'Fix options ready.',
      scroll: false,
    })

  const handleApplyFix = (suggestion: SwapSuggestion) => {
    setPreview(suggestion.run)
    setFixing(null)
  }

  const handleCancelFix = () => setFixing(null)

  // A stale fix target (from a since-replaced preview) must never linger.
  useEffect(() => {
    setFixing(null)
  }, [preview])

  // Bring the run into view. Without this the preview mounts below the fold and
  // the click reads as a no-op (M3.6 Finding 4).
  useEffect(() => {
    if (arrival === 0) return
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    previewRef.current?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'start',
    })
  }, [arrival])

  const doCommit = () => {
    if (!preview) return
    setError(null)
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
        presetIntent={presetIntent}
        priorities={priorities}
        feasibility={feasibility}
        playerCount={players.length}
        onGenerate={handleGenerate}
        generating={busy === 'generate'}
      />

      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>

      {(error || commit.isError) && (
        <div role="alert" className="card border border-red-200 bg-red-50">
          <p className="text-sm font-semibold text-red-700">{error ?? SAVE_FAILURE_MESSAGE}</p>
        </div>
      )}

      {preview && (
        <div ref={previewRef} className="scroll-mt-4">
          <SchedulePreview
            run={preview}
            onCompare={handleOpenCompare}
            onSave={handleSave}
            saving={commit.isPending}
            onFixRematch={handleFixRematch}
          />
        </div>
      )}

      {fixing && (
        <RematchFixPanel
          suggestions={fixing.suggestions}
          playerNamesById={playerNamesById}
          targetPair={fixing.pair}
          onApply={handleApplyFix}
          onCancel={handleCancelFix}
        />
      )}

      {preview && (
        <CompareView
          open={comparing}
          onClose={handleCloseCompare}
          original={preview}
          altConfig={altConfig}
          onAltConfigChange={setAltConfig}
          altResolvedConfig={altDerivations.resolved}
          altPresetIntent={altDerivations.presetIntent}
          altPriorities={altDerivations.priorities}
          altFeasibility={altDerivations.feasibility}
          playerCount={players.length}
          onGenerateAlt={handleGenerateAlt}
          generatingAlt={busy === 'alt'}
          altRun={altRun}
          onUseAlternative={handleUseAlternative}
        />
      )}

      {confirming && (
        <div className="card space-y-3 border border-red-200 bg-red-50">
          <div>
            <p className="font-semibold text-red-700 text-sm">Discard entered scores?</p>
            <p className="text-xs text-red-600 mt-0.5">
              This tournament already has scores entered. Saving a new schedule replaces every match
              and permanently discards those scores. Type{' '}
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
