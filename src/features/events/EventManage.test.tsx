// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import EventManage from './EventManage'
import { useMatches } from './useMatches'
import { useRegistrations } from './useRegistrations'
import { useEventPhase } from './useEventPhase'
import type { EventPhase } from './eventPhase'

afterEach(cleanup)

vi.mock('./useMatches', () => ({ useMatches: vi.fn() }))
vi.mock('./useRegistrations', () => ({ useRegistrations: vi.fn() }))
vi.mock('./useEventPhase', () => ({ useEventPhase: vi.fn() }))

// The panel's own behaviour is covered by RunOfShow.test.tsx; here we only
// assert that the slot appears at the right phase.
vi.mock('./RunOfShow', () => ({
  default: () => <div data-testid="run-of-show" />,
}))
vi.mock('./Payments', () => ({
  default: () => <div data-testid="payments-mock" />,
}))
vi.mock('../raffle/RaffleContainer', () => ({
  default: () => <div data-testid="raffle-mock" />,
}))
vi.mock('../raffle/RaffleEligibilityContainer', () => ({
  default: () => <div data-testid="eligibility-mock" />,
}))

const mockUseMatches = vi.mocked(useMatches)
const mockUseRegistrations = vi.mocked(useRegistrations)
const mockUseEventPhase = vi.mocked(useEventPhase)

const tournament = {
  id: 't1',
  name: 'Summer Smash',
} as unknown as Parameters<typeof EventManage>[0]['tournament']

const match = (overrides: Record<string, unknown> = {}) => ({
  id: 'm1',
  completed: false,
  score1: null as number | null,
  score2: null as number | null,
  ...overrides,
})

const setPhase = (phase: EventPhase) => {
  mockUseEventPhase.mockReturnValue({ phase, oscarsPhase: 'not_created' } as ReturnType<
    typeof useEventPhase
  >)
}

const renderManage = (initialEntry: string) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <EventManage tournament={tournament} onNavigate={vi.fn()} />
    </MemoryRouter>,
  )

beforeEach(() => {
  // Sensible defaults; individual tests override as needed.
  mockUseMatches.mockReturnValue({ data: [] } as unknown as ReturnType<typeof useMatches>)
  mockUseRegistrations.mockReturnValue({ data: [] } as unknown as ReturnType<
    typeof useRegistrations
  >)
  setPhase('live')
})

describe('EventManage — section routing', () => {
  it('mounts Payments for ?section=payments', async () => {
    renderManage('/events/t1/manage?section=payments')
    expect(await screen.findByTestId('payments-mock')).toBeTruthy()
  })

  it('mounts RaffleContainer for ?section=raffle', async () => {
    renderManage('/events/t1/manage?section=raffle')
    expect(await screen.findByTestId('raffle-mock')).toBeTruthy()
  })

  it('mounts RaffleEligibilityContainer for ?section=eligibility', async () => {
    renderManage('/events/t1/manage?section=eligibility')
    expect(await screen.findByTestId('eligibility-mock')).toBeTruthy()
  })

  it('falls back to overview when section is absent', () => {
    renderManage('/events/t1/manage')
    expect(screen.getByText('Scoring progress')).toBeTruthy()
  })

  it('falls back to overview when section is garbage', () => {
    renderManage('/events/t1/manage?section=nonsense')
    expect(screen.getByText('Scoring progress')).toBeTruthy()
  })

  it('updates the URL section when a different tab is chosen', async () => {
    renderManage('/events/t1/manage')
    fireEvent.click(screen.getByRole('button', { name: 'Payments' }))
    expect(await screen.findByTestId('payments-mock')).toBeTruthy()
  })
})

describe('EventManage — overview scoring progress', () => {
  it('shows roster, unpaid and scoring counts', () => {
    mockUseRegistrations.mockReturnValue({
      data: [
        { id: 'r1', status: 'registered', paymentStatus: 'paid' },
        { id: 'r2', status: 'registered', paymentStatus: 'unpaid' },
        { id: 'r3', status: 'registered', paymentStatus: null },
        { id: 'r4', status: 'cancelled', paymentStatus: null },
      ],
    } as unknown as ReturnType<typeof useRegistrations>)
    mockUseMatches.mockReturnValue({
      data: [
        match({ completed: true, score1: 6, score2: 4 }),
        match({ completed: true, score1: 6, score2: 2 }),
        match(),
      ],
    } as unknown as ReturnType<typeof useMatches>)

    renderManage('/events/t1/manage')

    expect(screen.getByText('3')).toBeTruthy() // registered
    expect(screen.getByText('2')).toBeTruthy() // unpaid
    expect(screen.getByText('2/3')).toBeTruthy() // scored
    expect(screen.getByText('2 of 3 matches scored')).toBeTruthy()
  })
})

describe('EventManage — run-of-show slot', () => {
  it('is absent while the event is live', () => {
    setPhase('live')
    renderManage('/events/t1/manage')
    expect(screen.queryByTestId('run-of-show')).toBeNull()
  })

  it('appears once the event is sealed', () => {
    setPhase('sealed')
    renderManage('/events/t1/manage')
    expect(screen.getByTestId('run-of-show')).toBeTruthy()
  })

  it('stays visible past sealed (social)', () => {
    setPhase('social')
    renderManage('/events/t1/manage')
    expect(screen.getByTestId('run-of-show')).toBeTruthy()
  })
})
