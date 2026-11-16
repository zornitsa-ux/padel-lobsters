import { levelProblem, parseLevel } from '../../lib/parseLevel'
import { QUESTIONS, TOTAL_STEPS, type QuestionKey } from './levellingQuestions'

export type PlaytomicChoice = 'yes' | 'no' | null

export interface LevellingState {
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

export function initialLevellingState({
  levelOnFile,
}: {
  levelOnFile: number | null
}): LevellingState {
  const prefilled = levelOnFile != null && levelOnFile > 0
  return {
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
        step: Math.min(state.step + 1, PLAYTOMIC_STEP),
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
  if (!text.trim()) return 'Enter your level, e.g. 2.5.'
  return levelProblem({ value: text, min: 0, aboveMin: true })
}

const allAnswered = (answers: LevellingState['answers']) =>
  QUESTIONS.every(({ key }) => answers[key] !== undefined)

export function canFinish(state: LevellingState): boolean {
  const { choice, text } = state.playtomic
  if (!allAnswered(state.answers) || choice === null) return false
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
    playtomic_level: state.playtomic.choice === 'yes' ? parseLevel(state.playtomic.text) : null,
    prefilled: state.prefilled,
  }
}
