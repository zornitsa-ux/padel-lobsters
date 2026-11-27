import {
  AMERICANO_PRESET,
  KING_OF_THE_COURT_PRESET,
  presetFor,
  recordsMatches,
  type EventPreset,
} from './presets'

// What the event form stores for a format: its preset's format and entry mode
// (D-020: King of the Court is played by teams, Americano by individuals).
const formFields = (preset: EventPreset) =>
  ({ format: preset.format, entryMode: preset.entry }) as const

export const AMERICANO = formFields(AMERICANO_PRESET)
export const KING_OF_THE_COURT = formFields(KING_OF_THE_COURT_PRESET)

export const isKingOfTheCourt = ({ format }: { format?: string | null }) =>
  format === KING_OF_THE_COURT.format

export const formatOption = ({ format }: { format?: string | null }) =>
  formFields(presetFor({ format }))

export type EventKind = { entryMode?: string | null; format?: string | null }

// A saved event's entry_mode decides; the format covers a form not saved yet.
export const isTeamEvent = ({ entryMode, format }: EventKind): boolean =>
  entryMode === 'team' || presetFor({ format }).entry === 'team'

// Scores sync live until ratings are applied (status `completed`), and only for
// a preset that records matches (King of the Court doesn't, D-006).
export const hasLiveScores = ({ status, format }: { status: string; format?: string | null }) =>
  status !== 'completed' && recordsMatches(presetFor({ format }))
