import { givenLevelProblem, parseLevel } from '../../../lib/parseLevel'

/** The hint when an admin gives the level of a player who has none (S6b). */
export const noLevelHint = ({ name }: { name: string }) =>
  `${name} has no level yet. Their Playtomic level, or your best guess, e.g. 2.0.`

/** Whether a required level is filled in and valid. */
export const isLevelGiven = ({ level }: { level: string }) =>
  givenLevelProblem({ value: level, blank: 'blank' }) === ''

/** The confirm line for a level an admin gives before registering someone (S6b). */
export const levelConfirmLine = ({ label, level }: { label: string; level: string }) =>
  `${label}: ${parseLevel(level)}, saved to their profile`
