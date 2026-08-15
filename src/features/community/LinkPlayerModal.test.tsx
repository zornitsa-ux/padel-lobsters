// @vitest-environment jsdom
import { useState } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { renderWithClient } from '../../test/renderWithClient'
import { mockSupabase } from '../../test/mockSupabase'

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }))
vi.mock('../../supabase', () => mockSupabase({ rpc: mockRpc }))

import LinkPlayerModal from './LinkPlayerModal'

const pending = { id: 'pending-1', name: 'New Joiner', status: 'pending' }
const ada = { id: 'ada-1', name: 'Ada Lovelace', playtomicLevel: 3.5 }
const alan = { id: 'alan-1', name: 'Alan Turing', playtomicLevel: 4.0 }

// The real component is controlled (linkSearch lives in the parent), so the
// test harness owns that bit of state the way Players.tsx does.
function Harness({ initialSearch = '' }: { initialSearch?: string }) {
  const [linkSearch, setLinkSearch] = useState(initialSearch)
  return (
    <LinkPlayerModal
      linkModal={pending}
      linkSearch={linkSearch}
      setLinkSearch={setLinkSearch}
      activePlayers={[ada, alan]}
      onClose={() => {}}
      onConfirm={() => {}}
    />
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRpc.mockImplementation((_fn: string, args: { input_target_id: string }) => {
    const email =
      args.input_target_id === 'pending-1'
        ? 'newjoiner@example.com'
        : args.input_target_id === 'ada-1'
          ? 'ada@example.com'
          : 'unknown@example.com'
    return Promise.resolve({
      data: [{ id: args.input_target_id, email, phone: '', birthday: null, notes: null }],
      error: null,
    })
  })
})

afterEach(cleanup)

describe('LinkPlayerModal — least-exposure search gate', () => {
  it('lists no candidates until the search has 2+ characters', () => {
    renderWithClient(<Harness />)
    expect(screen.getByText(/search for the existing player by name/i)).toBeTruthy()
    expect(screen.queryByText('Ada Lovelace')).toBeNull()
  })

  it('shows matching candidates once the search is long enough', () => {
    renderWithClient(<Harness initialSearch="ad" />)
    expect(screen.getByText('Ada Lovelace')).toBeTruthy()
    expect(screen.queryByText('Alan Turing')).toBeNull()
  })
})

describe('LinkPlayerModal — PII reveal', () => {
  it("fetches the pending signup's own email automatically on open", async () => {
    renderWithClient(<Harness />)
    await waitFor(() =>
      expect(mockRpc).toHaveBeenCalledWith('admin_get_player_pii', {
        input_target_id: 'pending-1',
      }),
    )
    await waitFor(() => expect(screen.getByText('newjoiner@example.com')).toBeTruthy())
  })

  it('does not fetch a candidate email until its reveal control is tapped', async () => {
    renderWithClient(<Harness initialSearch="ad" />)
    await waitFor(() =>
      expect(mockRpc).toHaveBeenCalledWith('admin_get_player_pii', {
        input_target_id: 'pending-1',
      }),
    )
    expect(mockRpc).not.toHaveBeenCalledWith('admin_get_player_pii', {
      input_target_id: 'ada-1',
    })

    fireEvent.click(screen.getByRole('button', { name: /show ada lovelace's email/i }))

    await waitFor(() => expect(screen.getByText('ada@example.com')).toBeTruthy())
  })

  it('confirming a candidate does not require revealing their email first', () => {
    const onConfirm = vi.fn()
    renderWithClient(
      <LinkPlayerModal
        linkModal={pending}
        linkSearch="ad"
        setLinkSearch={() => {}}
        activePlayers={[ada, alan]}
        onClose={() => {}}
        onConfirm={onConfirm}
      />,
    )
    fireEvent.click(screen.getByText('Ada Lovelace'))
    expect(onConfirm).toHaveBeenCalledWith(ada)
  })
})
