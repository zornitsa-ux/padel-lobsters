import { givenLevelProblem, parseLevel } from '../../lib/parseLevel'
import { QUESTIONS, TOTAL_STEPS, type QuestionKey } from './levellingQuestions'

export type PlaytomicChoice = 'yes' | 'no' | null

/**
 * `level` sets a start: five questions, then the Playtomic step. `questions` is for a
 * player who already has a level: the five questions only (S3c).
 */
export type LevellingMode = 'level' | 'questions'

export interface LevellingState {
  mode: LevellingMode
  /** 0–4 are the questions, 5 the Playtomic step. */
  step: number
  answers: Partial<Record<QuestionKey, string>>
  playtomic: { choice: PlaytomicChoice; text: string }
  /** Step 6 opened on a level already on the profile. */
  prefilled: boolean
}

export type LevellingAction =
  | { type: 'answer'; key: QuestionKey; code: string }
  | { type: 'back' }
  | { type: 'choosePlaytomic'; choice: Exclude<PlaytomicChoice, null> }
  | { type: 'typePlaytomic'; text: string }

// `type` alias, not interface, so it stays assignable to the RPC's Json argument.
export type LevellingPayload = Record<QuestionKey, string> & {
  playtomic_level: number | null
  prefilled: boolean
}

export const PLAYTOMIC_STEP = TOTAL_STEPS - 1

export const totalSteps = ({ mode }: { mode: LevellingMode }) =>
  mode === 'level' ? TOTAL_STEPS : QUESTIONS.length

const lastStep = ({ mode }: { mode: LevellingMode }) => totalSteps({ mode }) - 1

/** The step that carries Finish. */
export const isFinalStep = (state: LevellingState) => state.step === lastStep(state)

export function initialLevellingState({
  levelOnFile,
  mode = 'level',
}: {
  levelOnFile: number | null
  mode?: LevellingMode
}): LevellingState {
  const prefilled = mode === 'level' && levelOnFile != null && levelOnFile > 0
  return {
    mode,
    step: 0,
    answers: {},
    playtomic: prefilled
      ? { choice: 'yes', text: String(levelOnFile) }
      : { choice: null, text: '' },
    prefilled,
  }
}

export function levellingReducer(state: LevellingState, action: LevellingAction): LevellingState {
  switch (action.type) {
    case 'answer':
      return {
        ...state,
        answers: { ...state.answers, [action.key]: action.code },
        step: Math.min(state.step + 1, lastStep(state)),
      }
    case 'back':
      return { ...state, step: Math.max(state.step - 1, 0) }
    case 'choosePlaytomic':
      return { ...state, playtomic: { ...state.playtomic, choice: action.choice } }
    case 'typePlaytomic':
      return { ...state, playtomic: { ...state.playtomic, text: action.text } }
  }
}

/** Why the typed level can't be sent, or '' when it can. 0 means "no level" in the app. */
export function playtomicProblem({ text }: { text: string }): string {
  return givenLevelProblem({ value: text, blank: 'Enter your level, e.g. 2.5.' })
}

const allAnswered = (answers: LevellingState['answers']) =>
  QUESTIONS.every(({ key }) => answers[key] !== undefined)

export function canFinish(state: LevellingState): boolean {
  if (!allAnswered(state.answers)) return false
  if (state.mode === 'questions') return true
  const { choice, text } = state.playtomic
  if (choice === null) return false
  return choice === 'no' || playtomicProblem({ text }) === ''
}

/** Null until every step is valid. */
export function toPayload(state: LevellingState): LevellingPayload | null {
  if (!canFinish(state)) return null
  const answers = Object.fromEntries(
    QUESTIONS.map(({ key }) => [key, state.answers[key] as string]),
  ) as Record<QuestionKey, string>
  return {
    ...answers,
    playtomic_level:
      state.mode === 'level' && state.playtomic.choice === 'yes'
        ? parseLevel(state.playtomic.text)
        : null,
    prefilled: state.prefilled,
  }
}
