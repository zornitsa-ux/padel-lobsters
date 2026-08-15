// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react'

// Finding 5: opening player A then quickly player B must not let A's PII
// resolve (out of order) onto a form that's now editing B.
const { updatePlayerMock, ensurePlayerPiiMock } = vi.hoisted(() => ({
  updatePlayerMock: vi.fn(),
  ensurePlayerPiiMock: vi.fn(),
}))

const playerA = { id: 'a', name: 'Player A', status: 'active', email: '', phone: '' }
const playerB = { id: 'b', name: 'Player B', status: 'active', email: '', phone: '' }

vi.mock('../../context/useApp', () => ({
  useApp: () => ({
    session: { user: { id: 'admin-1', app_metadata: { role: 'admin' } } },
    role: 'admin',
  }),
}))
vi.mock('../events/useTournaments', () => ({ useTournaments: () => ({ data: [] }) }))
vi.mock('../events/useMatches', () => ({ useAllMatches: () => ({ data: [] }) }))
vi.mock('../events/useRegistrations', () => ({ useAllRegistrations: () => ({ data: [] }) }))
vi.mock('../../hooks/usePlayerAliases', () => ({ default: () => ({ playerAliases: {} }) }))
vi.mock('../../lib/confirmBus', () => ({ useConfirm: () => vi.fn() }))
vi.mock('../players/usePlayers', () => ({
  usePlayers: () => ({ data: [playerA, playerB] }),
  usePlayerPii: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  useEnsurePlayerPii: () => ensurePlayerPiiMock,
  useForgetPlayerPii: () => vi.fn(),
  usePlayerActions: () => ({
    addPlayer: vi.fn(),
    updatePlayer: updatePlayerMock,
    deletePlayer: vi.fn(),
    regeneratePin: vi.fn(),
  }),
  useAvatarUpload: () => ({ mutateAsync: vi.fn() }),
}))
vi.mock('./playerQueries', () => ({ randomAvatarFilename: () => 'x.webp' }))
vi.mock('./PlayersList', () => ({
  default: ({ onEdit }: { onEdit: (p: typeof playerA) => void }) => (
    <div>
      <button onClick={() => onEdit(playerA)}>edit A</button>
      <button onClick={() => onEdit(playerB)}>edit B</button>
    </div>
  ),
}))
vi.mock('./LinkPlayerModal', () => ({ default: () => null }))

import Players from './Players'

// A promise the test can resolve on demand, so it can control ordering.
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(cleanup)

describe('Players — openEdit request ordering', () => {
  it('a slower resolve for the first-opened player does not overwrite a later one', async () => {
    const pendingA = deferred<{ email: string; phone: string; birthday: string; notes: string }>()
    const pendingB = deferred<{ email: string; phone: string; birthday: string; notes: string }>()
    ensurePlayerPiiMock.mockImplementation((id: string) =>
      id === 'a' ? pendingA.promise : pendingB.promise,
    )

    render(<Players />)

    fireEvent.click(screen.getByText('edit A'))
    fireEvent.click(screen.getByText('edit B'))

    // B resolves first, then the stale A resolve lands after — awaited
    // through `act` so its state updates are fully flushed before the save,
    // otherwise the assertion below wouldn't observe a stale overwrite even
    // without the fix.
    await act(async () => {
      pendingB.resolve({ email: 'b@example.com', phone: '', birthday: '', notes: '' })
      await pendingB.promise
    })
    await waitFor(() => expect(screen.getByRole('button', { name: /save changes/i })).toBeTruthy())

    await act(async () => {
      pendingA.resolve({ email: 'a@example.com', phone: '', birthday: '', notes: '' })
      await pendingA.promise
    })

    // The form must still show B — A's late resolve must not land on it.
    expect(screen.getByDisplayValue('b@example.com')).toBeTruthy()
    expect(screen.queryByDisplayValue('a@example.com')).toBeNull()

    fireEvent.change(screen.getByDisplayValue('b@example.com'), {
      target: { value: 'b2@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(updatePlayerMock).toHaveBeenCalledTimes(1))

    // Saving must write onto B (diffed against B's baseline), never A's.
    const [id, patch] = updatePlayerMock.mock.calls[0]
    expect(id).toBe('b')
    expect(patch).toEqual({ email: 'b2@example.com' })
  })
})
