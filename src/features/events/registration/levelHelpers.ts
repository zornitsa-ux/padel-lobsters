import { formatLevel, givenLevel, levelProblem } from '../../../lib/level'

/** The hint when an admin gives the level of a player who has none (S6b). */
export const noLevelHint = ({ name }: { name: string }) =>
  `${name} has no level yet. Their Playtomic level, or your best guess, e.g. 2.0.`

/** Whether a required level is filled in and valid. */
export const isLevelGiven = ({ level }: { level: string }) =>
  levelProblem({ value: level, policy: 'required' }) === ''

/** The confirm line for a level an admin gives before registering someone (S6b). */
export const levelConfirmLine = ({ label, level }: { label: string; level: string }) => {
  const given = givenLevel({ value: level })
  return `${label}: ${given == null ? level : formatLevel({ level: given })}, saved to their profile`
}
