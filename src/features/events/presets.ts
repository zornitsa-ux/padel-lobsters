// An event's preset: the fixed set of parts its format implies (event-system
// DESIGN §4). Lifecycle code asks a part, not which format it is, so a new
// format adds a preset rather than a branch at every caller.

export type EventPreset = {
  id: 'americano' | 'king_of_the_court'
  format: 'lobster_matching' | 'king_of_court'
  entry: 'individual' | 'team'
  play: 'rounds_drawn_up_front' | 'not_recorded'
  scoring: 'points_per_match' | 'final_placings'
  standingsShown: 'on_reveal' | 'on_save'
  ratings: 'on' | 'off'
}

export const AMERICANO_PRESET = {
  id: 'americano',
  format: 'lobster_matching',
  entry: 'individual',
  play: 'rounds_drawn_up_front',
  scoring: 'points_per_match',
  standingsShown: 'on_reveal',
  ratings: 'on',
} as const satisfies EventPreset

export const KING_OF_THE_COURT_PRESET = {
  id: 'king_of_the_court',
  format: 'king_of_court',
  entry: 'team',
  play: 'not_recorded',
  scoring: 'final_placings',
  standingsShown: 'on_save',
  ratings: 'off',
} as const satisfies EventPreset

export const PRESETS: readonly EventPreset[] = [AMERICANO_PRESET, KING_OF_THE_COURT_PRESET]

// An unknown or missing format is Americano, the original format.
export function presetFor({ format }: { format?: string | null }): EventPreset {
  return PRESETS.find((p) => p.format === format) ?? AMERICANO_PRESET
}

// Each part reads the preset for a format, so an event row, a form or a preset
// can be passed as it is.
type HasFormat = { format?: string | null }

export const recordsMatches = ({ format }: HasFormat) =>
  presetFor({ format }).play !== 'not_recorded'

export const ratingsOn = ({ format }: HasFormat) => presetFor({ format }).ratings === 'on'

export const savesPlacings = ({ format }: HasFormat) =>
  presetFor({ format }).scoring === 'final_placings'

export const revealsStandings = ({ format }: HasFormat) =>
  presetFor({ format }).standingsShown === 'on_reveal'
