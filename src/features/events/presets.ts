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

export const AMERICANO_PRESET: EventPreset = {
  id: 'americano',
  format: 'lobster_matching',
  entry: 'individual',
  play: 'rounds_drawn_up_front',
  scoring: 'points_per_match',
  standingsShown: 'on_reveal',
  ratings: 'on',
}

export const KING_OF_THE_COURT_PRESET: EventPreset = {
  id: 'king_of_the_court',
  format: 'king_of_court',
  entry: 'team',
  play: 'not_recorded',
  scoring: 'final_placings',
  standingsShown: 'on_save',
  ratings: 'off',
}

export const PRESETS: readonly EventPreset[] = [AMERICANO_PRESET, KING_OF_THE_COURT_PRESET]

// An unknown or missing format is Americano, the original format.
export function presetFor({ format }: { format?: string | null }): EventPreset {
  return PRESETS.find((p) => p.format === format) ?? AMERICANO_PRESET
}

export const recordsMatches = (preset: EventPreset) => preset.play !== 'not_recorded'

export const ratingsOn = (preset: EventPreset) => preset.ratings === 'on'

export const savesPlacings = (preset: EventPreset) => preset.scoring === 'final_placings'

export const revealsStandings = (preset: EventPreset) => preset.standingsShown === 'on_reveal'
