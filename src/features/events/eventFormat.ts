// Each format fixes how people enter (D-020): King of the Court is played by
// teams, Americano by individuals.
export const AMERICANO = { format: 'lobster_matching', entryMode: 'individual' } as const
export const KING_OF_THE_COURT = { format: 'king_of_court', entryMode: 'team' } as const

export const isKingOfTheCourt = ({ format }: { format?: string | null }) =>
  format === KING_OF_THE_COURT.format

export const formatOption = ({ format }: { format?: string | null }) =>
  isKingOfTheCourt({ format }) ? KING_OF_THE_COURT : AMERICANO

export type EventKind = { entryMode?: string | null; format?: string | null }

// A saved event's entry_mode decides; the format covers a form not saved yet.
export const isTeamEvent = ({ entryMode, format }: EventKind): boolean =>
  entryMode === 'team' || formatOption({ format }).entryMode === 'team'

// Scores sync live until the event completes. King of the Court records no
// matches (D-006), so it has nothing to sync.
export const hasLiveScores = ({ status, format }: { status: string; format?: string | null }) =>
  status !== 'completed' && !isKingOfTheCourt({ format })
