// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { completeLevelling, levellingState, resetLevellingMock } from '../../test/levellingMock'
import { QUESTIONS } from './levellingQuestions'

const m = vi.hoisted(() => ({
  confirm: vi.fn(),
  showToast: vi.fn(),
  userId: 'player-1',
}))

vi.mock('./useMyLevelling', () => import('../../test/levellingMock'))
vi.mock('../../context/useApp', () => ({
  useApp: () => ({ session: { user: { id: m.userId } }, sessionSettled: true }),
}))
vi.mock('../../lib/confirmBus', () => ({ useConfirm: () => m.confirm }))
vi.mock('../../lib/toastBus', () => ({ useToast: () => ({ showToast: m.showToast }) }))
vi.mock('../players/usePlayers', () => ({
  usePlayer: () => ({ data: { id: 'player-1', name: 'Sam Lobster' } }),
}))

import LevellingPage from './LevellingPage'

const FROM = '/events/e1/info'

const renderFlow = () =>
  render(
    <MemoryRouter initialEntries={[`/levelling?from=${encodeURIComponent(FROM)}`]}>
      <Routes>
        <Route path="/levelling" element={<LevellingPage />} />
        <Route path={FROM} element={<p>EVENT PAGE</p>} />
      </Routes>
    </MemoryRouter>,
  )

const tap = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

const answerFiveQuestions = () => {
  for (const question of QUESTIONS) {
    screen.getByRole('heading', { name: question.title })
    tap(question.options[1].label)
  }
}

let userCount = 0
beforeEach(() => {
  resetLevellingMock()
  levellingState.needsLevelling = true
  // A fresh user each test: drafts are kept per user for the session.
  m.userId = `player-${++userCount}`
  m.confirm.mockReset()
  m.showToast.mockReset()
})
afterEach(cleanup)

describe('LevellingPage', () => {
  it('moves on with each tap and counts six steps', () => {
    renderFlow()
    expect(screen.getByText('1 of 6')).toBeTruthy()
    answerFiveQuestions()
    expect(screen.getByText('6 of 6')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Do you have a Playtomic level?' })).toBeTruthy()
  })

  it('keeps the earlier answer when going back', () => {
    renderFlow()
    tap(QUESTIONS[0].options[2].label)
    tap('Back')
    const chosen = screen.getByRole('button', { name: QUESTIONS[0].options[2].label })
    expect(chosen.getAttribute('aria-pressed')).toBe('true')
  })

  it('keeps Finish disabled until the Playtomic step is valid', () => {
    renderFlow()
    answerFiveQuestions()
    const finish = () => screen.getByRole('button', { name: 'Finish' }) as HTMLButtonElement
    expect(finish().disabled).toBe(true)
    tap('Yes')
    fireEvent.change(screen.getByLabelText(/Your Playtomic level/), { target: { value: '9' } })
    expect(finish().disabled).toBe(true)
    expect(screen.getByRole('status').textContent).toMatch(/up to 7/)
    fireEvent.change(screen.getByLabelText(/Your Playtomic level/), { target: { value: '2,5' } })
    expect(finish().disabled).toBe(false)
  })

  it('finishes: sends the answers, returns to the event and thanks the player by first name', async () => {
    completeLevelling.mockResolvedValue('ok')
    renderFlow()
    answerFiveQuestions()
    tap('No, or I’m not sure')
    tap('Finish')
    await screen.findByText('EVENT PAGE')
    expect(completeLevelling).toHaveBeenCalledWith({
      payload: {
        years_playing: 'under_1y',
        frequency: 'few_per_month',
        lessons: '1_to_10',
        racket_sports: 'casual',
        walls: 'slow_back_wall',
        playtomic_level: null,
        prefilled: false,
      },
    })
    expect(m.showToast).toHaveBeenCalledWith({
      variant: 'success',
      message: 'Thanks, Sam! You’re all set and ready to register for an event.',
    })
  })

  it('prefills step 6 for a player with a level on file', () => {
    levellingState.levelOnFile = 2.3
    renderFlow()
    answerFiveQuestions()
    expect(
      screen.getByRole('heading', { name: 'Is this still your Playtomic level?' }),
    ).toBeTruthy()
    expect((screen.getByLabelText(/Your Playtomic level/) as HTMLInputElement).value).toBe('2.3')
  })

  it('stays put with an error when the answers are refused', async () => {
    completeLevelling.mockResolvedValue('invalid_answers')
    renderFlow()
    answerFiveQuestions()
    tap('No, or I’m not sure')
    tap('Finish')
    expect(await screen.findByText(/couldn’t save your answers/)).toBeTruthy()
    expect(m.showToast).not.toHaveBeenCalled()
  })

  it('asks before closing, and keeps the answers for the session', async () => {
    m.confirm.mockResolvedValue(true)
    const first = renderFlow()
    tap(QUESTIONS[0].options[0].label)
    tap('Stop setting your level')
    await screen.findByText('EVENT PAGE')
    expect(m.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Stop now?' }))
    first.unmount()
    renderFlow()
    expect(screen.getByText('2 of 6')).toBeTruthy()
  })

  it('stays when the player cancels closing', async () => {
    m.confirm.mockResolvedValue(false)
    renderFlow()
    tap('Stop setting your level')
    await waitFor(() => expect(m.confirm).toHaveBeenCalled())
    expect(screen.getByText('1 of 6')).toBeTruthy()
  })

  it('sends a player who no longer needs levelling straight back', () => {
    levellingState.needsLevelling = false
    renderFlow()
    expect(screen.getByText('EVENT PAGE')).toBeTruthy()
  })
})
