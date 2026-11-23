import { errorCode, errorMessage } from './errors'

// No level is null (signup revamp S9). 0 isn't a level either (D-5, D-14).
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

/** A level as written: "2.45" as it is, never rounded; "3" and "2.5" with one decimal. */
export const formatLevel = ({ level }: { level: number }): string =>
  Math.round(level * 100) % 10 === 0 ? level.toFixed(1) : level.toFixed(2)

/** "Lv 2.45", or undefined for a player with no level, who shows none (D-14). */
export const levelText = ({
  level,
  prefix = 'Lv',
}: {
  level: number | null | undefined
  prefix?: string
}): string | undefined => {
  const value = knownLevel({ level })
  return value == null ? undefined : `${prefix} ${formatLevel({ level: value })}`
}

/** A recorded level as a form field starts: the level, or empty for none. */
export const levelFieldValue = ({ level }: { level: number | null | undefined }): string => {
  const value = knownLevel({ level })
  return value == null ? '' : String(value)
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

/** A level the database refused, with the reason in words. */
export class LevelRefusal extends Error {}

/** The error to show: a level refusal in words, anything else unchanged. */
export function withLevelMessage({ error }: { error: unknown }): unknown {
  const message = levelRefusalMessage({ error })
  return message ? new LevelRefusal(message) : error
}

// ── Typed levels (DESIGN §6.2) ───────────────────────────────────────────────
// The same rule as private.parse_level and private.level_to_store; both are
// checked against supabase/tests/level_cases.json.

/** Each input's policy: whether blank is allowed (DESIGN §6.2). */
export type LevelPolicy = 'required' | 'optional' | 'keep'

/** What a typed level comes to under a policy, as level_cases.json spells it. */
export type LevelOutcome = number | 'no_level' | 'blank' | 'invalid'

const LEVEL_FORMAT = /^[0-9]+(\.[0-9]{1,2})?$/

/**
 * A typed level: the number, null for no level (blank or 0), or 'invalid'.
 * Accepts a decimal comma. The format is checked before zero, so "0.000" is invalid.
 */
export function parseLevel({ value }: { value: unknown }): number | null | 'invalid' {
  const text = String(value ?? '')
    .trim()
    .replace(',', '.')
  if (text === '') return null
  if (!LEVEL_FORMAT.test(text)) return 'invalid'
  const level = Number(text)
  if (level === 0) return null
  return level > 7 ? 'invalid' : level
}

/** The typed level when it is one, else null (blank, 0 or invalid). */
export function givenLevel({ value }: { value: unknown }): number | null {
  const level = parseLevel({ value })
  return typeof level === 'number' ? level : null
}

export function levelOutcome({
  value,
  policy,
}: {
  value: unknown
  policy: LevelPolicy
}): LevelOutcome {
  const level = parseLevel({ value })
  if (level !== null) return level
  return policy === 'optional' ? 'no_level' : 'blank'
}

/** Settings and the admin editor: keep once a level is recorded, optional before. */
export const levelPolicy = ({ recorded }: { recorded: number | null | undefined }): LevelPolicy =>
  hasLevel({ level: recorded }) ? 'keep' : 'optional'

// A required level left blank is refused as invalid_level by the server too.
const BLANK_MESSAGES: Record<LevelPolicy, string> = {
  required: INVALID_LEVEL_MESSAGE,
  optional: '',
  keep: LEVEL_REQUIRED_MESSAGE,
}

/** Why a typed level can't be saved under its policy, or '' when it can. */
export function levelProblem({ value, policy }: { value: unknown; policy: LevelPolicy }): string {
  const outcome = levelOutcome({ value, policy })
  if (outcome === 'invalid') return INVALID_LEVEL_MESSAGE
  return outcome === 'blank' ? BLANK_MESSAGES[policy] : ''
}

/** For a field that waits quietly while empty: the problem once something is typed. */
export const typedLevelProblem = ({
  value,
  policy,
}: {
  value: unknown
  policy: LevelPolicy
}): string => (String(value ?? '').trim() ? levelProblem({ value, policy }) : '')

/**
 * A level as the write RPCs take it: the text as typed, so the server's
 * level_to_store gives the refusal. Trimmed here, so the server never meets
 * whitespace the client's check let through. Missing becomes '' (no level), never "null".
 */
export const typedLevel = ({ value }: { value: string | number | null | undefined }): string =>
  value == null ? '' : String(value).trim()
