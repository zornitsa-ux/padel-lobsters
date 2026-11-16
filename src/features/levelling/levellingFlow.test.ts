import { describe, expect, it } from 'vitest'
import {
  canFinish,
  initialLevellingState,
  levellingReducer,
  PLAYTOMIC_STEP,
  playtomicProblem,
  toPayload,
  type LevellingAction,
  type LevellingState,
} from './levellingFlow'
import { QUESTIONS } from './levellingQuestions'

const run = (state: LevellingState, actions: LevellingAction[]) =>
  actions.reduce(levellingReducer, state)

const answerAll: LevellingAction[] = QUESTIONS.map(({ key, options }) => ({
  type: 'answer',
  key,
  code: options[0].code,
}))

const fresh = () => initialLevellingState({ levelOnFile: null })

describe('initialLevellingState', () => {
  it('starts with nothing chosen when there is no level on file', () => {
    expect(fresh()).toEqual({
      step: 0,
      answers: {},
      playtomic: { choice: null, text: '' },
      prefilled: false,
    })
  })

  it('prefills step 6 with a level on file', () => {
    const state = initialLevellingState({ levelOnFile: 2.3 })
    expect(state.playtomic).toEqual({ choice: 'yes', text: '2.3' })
    expect(state.prefilled).toBe(true)
  })

  it('treats 0 as no level', () => {
    expect(initialLevellingState({ levelOnFile: 0 }).prefilled).toBe(false)
  })
})

describe('levellingReducer', () => {
  it('records an answer and moves on', () => {
    const state = run(fresh(), [answerAll[0]])
    expect(state.step).toBe(1)
    expect(state.answers.years_playing).toBe('few_times')
  })

  it('stops at the Playtomic step', () => {
    expect(run(fresh(), answerAll).step).toBe(PLAYTOMIC_STEP)
  })

  it('keeps answers when going back, and never below step 0', () => {
    const state = run(fresh(), [answerAll[0], answerAll[1], { type: 'back' }])
    expect(state.step).toBe(1)
    expect(state.answers).toEqual({ years_playing: 'few_times', frequency: 'monthly_or_less' })
    expect(run(fresh(), [{ type: 'back' }]).step).toBe(0)
  })

  it('changes an earlier answer after going back', () => {
    const state = run(fresh(), [
      answerAll[0],
      { type: 'back' },
      { type: 'answer', key: 'years_playing', code: 'over_3y' },
    ])
    expect(state.answers.years_playing).toBe('over_3y')
    expect(state.step).toBe(1)
  })

  it('keeps the typed level when switching to no and back', () => {
    const state = run(fresh(), [
      { type: 'choosePlaytomic', choice: 'yes' },
      { type: 'typePlaytomic', text: '3' },
      { type: 'choosePlaytomic', choice: 'no' },
      { type: 'choosePlaytomic', choice: 'yes' },
    ])
    expect(state.playtomic).toEqual({ choice: 'yes', text: '3' })
  })
})

describe('playtomicProblem', () => {
  it.each(['0.1', '2,5', ' 3.25 ', '7'])('takes %j', (text) => {
    expect(playtomicProblem({ text })).toBe('')
  })

  it.each(['', '  ', '0', '7.1', 'abc', '-1'])('refuses %j', (text) => {
    expect(playtomicProblem({ text })).not.toBe('')
  })
})

describe('canFinish and toPayload', () => {
  it('needs every question answered', () => {
    const state = run(fresh(), [
      ...answerAll.slice(0, 4),
      { type: 'choosePlaytomic', choice: 'no' },
    ])
    expect(canFinish(state)).toBe(false)
    expect(toPayload(state)).toBeNull()
  })

  it('needs a Playtomic choice', () => {
    expect(canFinish(run(fresh(), answerAll))).toBe(false)
  })

  it('needs a valid level when the answer is yes', () => {
    const state = run(fresh(), [
      ...answerAll,
      { type: 'choosePlaytomic', choice: 'yes' },
      { type: 'typePlaytomic', text: '8' },
    ])
    expect(canFinish(state)).toBe(false)
  })

  it('sends a null level for no, even with a level typed earlier', () => {
    const state = run(fresh(), [
      ...answerAll,
      { type: 'typePlaytomic', text: '3' },
      { type: 'choosePlaytomic', choice: 'no' },
    ])
    expect(toPayload(state)).toEqual({
      years_playing: 'few_times',
      frequency: 'monthly_or_less',
      lessons: 'none',
      racket_sports: 'none',
      walls: 'lets_go',
      playtomic_level: null,
      prefilled: false,
    })
  })

  it('parses a comma decimal and keeps the prefill flag', () => {
    const state = run(initialLevellingState({ levelOnFile: 2.3 }), [
      ...answerAll,
      { type: 'typePlaytomic', text: '2,8' },
    ])
    expect(toPayload(state)).toMatchObject({ playtomic_level: 2.8, prefilled: true })
  })
})
