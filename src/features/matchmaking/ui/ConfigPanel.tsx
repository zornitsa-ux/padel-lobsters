import { useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, RotateCcw, Shuffle } from 'lucide-react'
import { COURT_JITTER_SCALE } from '../domain/courts'
import type { MatcherPriority } from '../domain/presets'
import type {
  FeasibilityResult,
  MatchConfig,
  MatchPreset,
  ResolvedConfig,
} from '../domain/types'
import { DIMENSION_LABELS } from './dimensions'

export type ConfigPanelProps = {
  // Controlled config: preset + optional knob overrides. Container owns state.
  config: MatchConfig
  onConfigChange: (next: MatchConfig) => void
  // Preset-expanded effective knob values (container called resolveConfig).
  // Drives the Advanced panel's displayed effective values.
  resolvedConfig: ResolvedConfig
  // One-line plain-language intent for the selected preset (PRESET_INTENT).
  // Always visible under the preset control — not gated behind Advanced.
  presetIntent: string
  // Quality dimensions ranked by how hard the matcher protects them (container
  // called matcherPriorities). Render as the tie-break order inside Advanced.
  priorities: MatcherPriority[]
  // Stage-0 preflight audit (container called auditFeasibility on the current
  // roster + resolvedConfig). Render its entries as chips above Generate.
  feasibility: FeasibilityResult
  playerCount: number
  onGenerate: () => void
  generating: boolean
}

const PRESETS: { value: MatchPreset; label: string }[] = [
  { value: 'competitive', label: 'Competitive' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'social', label: 'Social' },
]

const RULE_LABELS: Record<string, string> = {
  ok: 'OK',
  relaxed: 'Relaxed',
  infeasible: 'Infeasible',
}

const CHIP_STATUS_CLASSES: Record<string, string> = {
  ok: 'bg-green-50 text-green-700',
  relaxed: 'bg-amber-50 text-amber-700',
  infeasible: 'bg-red-50 text-red-700',
}

type NumericKnob = 'socialDial' | 'maxCourtSpread' | 'maxPartnerGap' | 'balanceTolerance'

const round2 = (n: number): number => Math.round(n * 100) / 100

// Worked examples are anchored on a mid-table player so the copy reads in
// Playtomic levels — the only scale admins actually think in.
const EXAMPLE_LEVEL = 3.0
const lvl = (n: number): string => round2(n).toFixed(1)

const NUMERIC_KNOBS: {
  key: NumericKnob
  label: string
  min: number
  max: number
  step: number
  // Copy rule (D-022): say what a player would notice on court, in Playtomic
  // levels. Never the cost model's vocabulary — no "free", "excess", "units",
  // no weights or exchange rates. describe = what this setting does now;
  // effect = what you trade for it.
  describe: (value: number) => string
  effect: string
  // balanceTolerance is lower = stricter, so the slider is reversed to make
  // right = stricter. Display transform only; the domain knob is unchanged.
  // The transform is an involution over [min,max] (v ↦ min+max−v).
  invert?: boolean
}[] = [
  {
    key: 'socialDial',
    label: 'Social dial',
    min: 0,
    max: 1,
    step: 0.05,
    describe: (value) => {
      if (value === 0) {
        return 'Courts are set strictly by level — you play with the three people closest to you, and reshuffling gives you the same courts every time.'
      }
      const swing = value * COURT_JITTER_SCALE
      return `A ${lvl(EXAMPLE_LEVEL)} player can end up on a court with anyone from ${lvl(
        EXAMPLE_LEVEL - swing,
      )} to ${lvl(EXAMPLE_LEVEL + swing)}, so people regularly play outside their usual group.`
    },
    effect: 'More mixing means you meet more of the room, but games are less even.',
  },
  {
    key: 'maxCourtSpread',
    label: 'Max court spread',
    min: 0.25,
    max: 3.0,
    step: 0.25,
    describe: (value) =>
      `The strongest and weakest player in one game can be about ${lvl(
        value,
      )} levels apart — a ${lvl(EXAMPLE_LEVEL)} sharing a court with a ${lvl(
        EXAMPLE_LEVEL + value,
      )}. Push it wider and the matcher starts breaking those courts up.`,
    effect:
      'Wider courts mix the room more, but the weakest player in the game can feel out of their depth.',
  },
  {
    key: 'maxPartnerGap',
    label: 'Max partner gap',
    min: 0.25,
    max: 2.0,
    step: 0.25,
    describe: (value) =>
      `You and your partner can be about ${lvl(value)} levels apart — a ${lvl(
        EXAMPLE_LEVEL,
      )} playing with a ${lvl(
        EXAMPLE_LEVEL + value,
      )}. Beyond that the matcher tries to split the pair up.`,
    effect:
      'Bigger gaps open up more partner combinations, but the weaker partner tends to get picked on.',
  },
  {
    key: 'balanceTolerance',
    label: 'Balance strictness',
    min: 0.1,
    max: 1.5,
    step: 0.1,
    invert: true,
    // No worked number here on purpose: unlike the others this isn't a
    // level threshold, it's how heavily any gap weighs. A number would read
    // as an allowance and mean the opposite of the truth.
    describe: () =>
      `The two teams in a game are compared by adding their levels together — a ${lvl(
        EXAMPLE_LEVEL,
      )} and a ${lvl(EXAMPLE_LEVEL + 1)} make ${lvl(
        EXAMPLE_LEVEL * 2 + 1,
      )}. This is how close those totals need to be, so games finish tight instead of 6-1.`,
    effect:
      'Stricter gives you closer games, but to find them the matcher repeats opponents and mixes courts more. Looser accepts the odd one-sided game and keeps matchups fresh.',
  },
]

function clearOverride({
  config,
  key,
}: {
  config: MatchConfig
  key: keyof MatchConfig
}): MatchConfig {
  const next = { ...config }
  delete next[key]
  return next
}

export default function ConfigPanel({
  config,
  onConfigChange,
  resolvedConfig,
  presetIntent,
  priorities,
  feasibility,
  playerCount,
  onGenerate,
  generating,
}: ConfigPanelProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const infeasibleEntry = feasibility.entries.find((entry) => entry.status === 'infeasible')
  const notEnoughPlayers = playerCount < 4
  const disabled = generating || notEnoughPlayers || !feasibility.feasible

  return (
    <div className="card space-y-3">
      <p className="font-semibold text-gray-700 text-sm">Configure schedule</p>

      <div>
        <label className="label">Preset</label>
        <div className="flex gap-2">
          {PRESETS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onConfigChange({ preset: value })}
              className={`flex-1 py-2 text-sm rounded-xl font-semibold transition-all ${
                config.preset === value ? 'bg-lob-teal text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">{presetIntent}</p>
      </div>

      <button
        type="button"
        onClick={() => setAdvancedOpen((open) => !open)}
        className="flex items-center gap-1 text-sm font-semibold text-lob-teal"
      >
        {advancedOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        Advanced
      </button>

      {advancedOpen && (
        <div className="space-y-3 pl-1">
          {NUMERIC_KNOBS.map(({ key, label, min, max, step, describe, effect, invert }) => {
            const overridden = config[key] !== undefined
            const value = resolvedConfig[key]
            const toDisplay = (v: number) => (invert ? round2(min + max - v) : v)
            return (
              <div key={key}>
                <div className="flex items-center justify-between">
                  <label className="label mb-0">{label}</label>
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    {toDisplay(value)}
                    {overridden && (
                      <>
                        <span
                          className="text-lob-teal font-medium"
                          title="Overridden from preset default"
                        >
                          overridden
                        </span>
                        <button
                          type="button"
                          onClick={() => onConfigChange(clearOverride({ config, key }))}
                          className="text-gray-400 hover:text-gray-600"
                          title="Reset to preset default"
                        >
                          <RotateCcw size={12} />
                        </button>
                      </>
                    )}
                  </span>
                </div>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={toDisplay(value)}
                  onChange={(event) =>
                    onConfigChange({ ...config, [key]: toDisplay(Number(event.target.value)) })
                  }
                  className="w-full accent-lob-teal"
                />
                <p className="text-xs text-gray-500">{describe(value)}</p>
                <p className="text-xs text-gray-400">{effect}</p>
              </div>
            )
          })}

          <div>
            <div className="flex items-center justify-between">
              <label className="label mb-0">Lefty rule</label>
              {config.leftyRule !== undefined && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <span className="text-lob-teal font-medium" title="Overridden from preset default">
                    overridden
                  </span>
                  <button
                    type="button"
                    onClick={() => onConfigChange(clearOverride({ config, key: 'leftyRule' }))}
                    className="text-gray-400 hover:text-gray-600"
                    title="Reset to preset default"
                  >
                    <RotateCcw size={12} />
                  </button>
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onConfigChange({ ...config, leftyRule: 'hard' })}
                className={`flex-1 py-2 text-sm rounded-xl font-semibold transition-all ${
                  resolvedConfig.leftyRule === 'hard'
                    ? 'bg-lob-teal text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Keep lefties apart
              </button>
              <button
                type="button"
                onClick={() => onConfigChange({ ...config, leftyRule: 'off' })}
                className={`flex-1 py-2 text-sm rounded-xl font-semibold transition-all ${
                  resolvedConfig.leftyRule === 'off'
                    ? 'bg-lob-teal text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                Ignore
              </button>
            </div>
          </div>

          {priorities.length > 0 && (
            <div className="pt-1">
              <p className="text-xs text-gray-500">
                No schedule can be perfect at everything. When the matcher has to choose, this
                is what it hangs on to longest — the ones at the bottom slip first:
              </p>
              <ol className="mt-1 space-y-0.5 text-xs text-gray-500 list-decimal pl-4">
                {priorities.map(({ key }) => (
                  <li key={key}>{DIMENSION_LABELS[key]}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
          {feasibility.courtsUsed} court{feasibility.courtsUsed === 1 ? '' : 's'} ·{' '}
          {feasibility.sittersPerRound} sit-out{feasibility.sittersPerRound === 1 ? '' : 's'}/round
        </span>
        {feasibility.entries.map((entry) => (
          <span
            key={entry.rule}
            title={entry.detail}
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              CHIP_STATUS_CLASSES[entry.status] ?? 'bg-gray-100 text-gray-600'
            }`}
          >
            {entry.rule} · {RULE_LABELS[entry.status] ?? entry.status}
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={onGenerate}
        disabled={disabled}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {generating ? <Loader2 size={16} className="animate-spin" /> : <Shuffle size={16} />}
        {generating ? 'Generating…' : 'Generate schedule'}
      </button>

      {notEnoughPlayers && (
        <p className="text-xs text-orange-600">Register at least 4 players first</p>
      )}
      {!notEnoughPlayers && !feasibility.feasible && infeasibleEntry && (
        <p className="text-xs text-red-600">{infeasibleEntry.detail}</p>
      )}
    </div>
  )
}
