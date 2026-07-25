import { useMemo } from 'react'
import { auditFeasibility } from './domain/feasibility'
import { PRESET_INTENT, matcherPriorities, resolveConfig } from './domain/presets'
import type { MatcherPriority } from './domain/presets'
import type { FeasibilityResult, GenderMode, MatchConfig, ResolvedConfig } from './domain/types'
import { toPlayerInput } from './generateSchedule.service'

type PlayerInput = ReturnType<typeof toPlayerInput>

// Shared config-derivation pipeline: resolve preset + overrides, then derive
// the priority order, feasibility audit, and preset intent copy from it. Used
// for both the primary config and the compare-view alternative (M3.7).
export function useConfigDerivations({
  config,
  players,
  courts,
  rounds,
  genderMode,
  tournamentId,
}: {
  config: MatchConfig
  players: PlayerInput[]
  courts: number
  rounds: number
  genderMode: GenderMode
  tournamentId: string
}): {
  resolved: ResolvedConfig
  priorities: MatcherPriority[]
  feasibility: FeasibilityResult
  presetIntent: string
} {
  const resolved = useMemo(() => resolveConfig({ config, tournamentId }), [config, tournamentId])
  const priorities = useMemo(() => matcherPriorities({ config: resolved }), [resolved])
  const feasibility = useMemo(
    () => auditFeasibility({ players, courts, rounds, genderMode, config: resolved }),
    [players, courts, rounds, genderMode, resolved],
  )
  const presetIntent = PRESET_INTENT[config.preset]

  return { resolved, priorities, feasibility, presetIntent }
}
