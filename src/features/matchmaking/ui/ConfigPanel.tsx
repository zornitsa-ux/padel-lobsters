import { useState } from 'react'
import { ChevronDown, ChevronRight, RotateCcw, Shuffle } from 'lucide-react'
import type {
  FeasibilityResult,
  MatchConfig,
  MatchPreset,
  ResolvedConfig,
} from '../domain/types'

export type ConfigPanelProps = {
  // Controlled config: preset + optional knob overrides. Container owns state.
  config: MatchConfig
  onConfigChange: (next: MatchConfig) => void
  // Preset-expanded effective knob values (container called resolveConfig).
  // Drives the Advanced panel's displayed effective values.
  resolvedConfig: ResolvedConfig
  // Human-readable exchange-rate helper text (container called
  // exchangeRateSentences). Render as a small helper list inside Advanced.
  exchangeSentences: string[]
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

const NUMERIC_KNOBS: {
  key: NumericKnob
  label: string
  min: number
  max: number
  step: number
}[] = [
  { key: 'socialDial', label: 'Social dial', min: 0, max: 1, step: 0.05 },
  { key: 'maxCourtSpread', label: 'Max court spread', min: 0.25, max: 3.0, step: 0.25 },
  { key: 'maxPartnerGap', label: 'Max partner gap', min: 0.25, max: 2.0, step: 0.25 },
  { key: 'balanceTolerance', label: 'Balance tolerance', min: 0.1, max: 1.5, step: 0.1 },
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
  exchangeSentences,
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
          {NUMERIC_KNOBS.map(({ key, label, min, max, step }) => {
            const overridden = config[key] !== undefined
            const value = resolvedConfig[key]
            return (
              <div key={key}>
                <div className="flex items-center justify-between">
                  <label className="label mb-0">{label}</label>
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    {value}
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
                  value={value}
                  onChange={(event) =>
                    onConfigChange({ ...config, [key]: Number(event.target.value) })
                  }
                  className="w-full accent-lob-teal"
                />
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

          {exchangeSentences.length > 0 && (
            <ul className="space-y-1 text-xs text-gray-500 list-disc pl-4">
              {exchangeSentences.map((sentence) => (
                <li key={sentence}>{sentence}</li>
              ))}
            </ul>
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
        <Shuffle size={16} />
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
