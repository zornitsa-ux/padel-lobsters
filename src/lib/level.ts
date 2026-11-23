import { errorCode, errorMessage } from './errors'

// A Playtomic level of 0 means none was given (signup revamp D-5, D-14).
export const knownLevel = ({ level }: { level: number | null | undefined }): number | null =>
  level != null && level > 0 ? level : null

export const hasLevel = ({ level }: { level: number | null | undefined }): boolean =>
  knownLevel({ level }) != null

// D-15: a player with no level counts as the lowest walls start, the same on
// every screen and in the matcher's prior.
export const NO_LEVEL_START = 1

/** The level, or NO_LEVEL_START for a player with none. */
export const levelOrNoLevelStart = ({ level }: { level: number | null | undefined }): number =>
  knownLevel({ level }) ?? NO_LEVEL_START

/** "Lv 2.5", or undefined for a player with no level, who shows none (D-14). */
export const levelText = ({
  level,
  prefix = 'Lv',
}: {
  level: number | null | undefined
  prefix?: string
}): string | undefined => {
  const value = knownLevel({ level })
  return value == null ? undefined : `${prefix} ${value.toFixed(1)}`
}

// One definition of a level (docs/signup-revamp DESIGN §6). The database
// refuses anything else (C-8); these are its refusals in words.

export const INVALID_LEVEL_MESSAGE =
  'Playtomic level must be a number above 0 and up to 7, with at most 2 decimals, e.g. 2.45.'

export const LEVEL_REQUIRED_MESSAGE =
  'Enter a Playtomic level. A level can be changed, but not removed.'

const LEVEL_REFUSALS: Record<string, string> = {
  invalid_level: INVALID_LEVEL_MESSAGE,
  level_required: LEVEL_REQUIRED_MESSAGE,
}

/** The message for a database level refusal, or null for any other error. */
export function levelRefusalMessage({ error }: { error: unknown }): string | null {
  if (errorCode(error) !== 'P0001') return null
  return LEVEL_REFUSALS[errorMessage(error, '')] ?? null
}

/** The error to show: a level refusal in words, anything else unchanged. */
export function withLevelMessage({ error }: { error: unknown }): unknown {
  const message = levelRefusalMessage({ error })
  return message ? new Error(message) : error
}
