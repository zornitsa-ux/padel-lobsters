import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockSupabase } from '../../test/mockSupabase'

const { remove, readRow } = vi.hoisted(() => ({ remove: vi.fn(), readRow: vi.fn() }))

vi.mock('../../supabase', () =>
  mockSupabase({
    storage: { from: () => ({ remove }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: readRow }) }) }),
  }),
)

import { avatarObjectName, removeAvatar } from './playerQueries'

const BASE = 'http://127.0.0.1:54321/storage/v1/object/public/avatars'

beforeEach(() => {
  vi.clearAllMocks()
  remove.mockResolvedValue({ data: [], error: null })
  readRow.mockResolvedValue({ data: { avatar_url: '' }, error: null })
})

const withPhoto = (url: string) =>
  readRow.mockResolvedValue({ data: { avatar_url: url }, error: null })

describe('avatarObjectName', () => {
  it('reads the file from an avatars URL, without the cache buster', () => {
    expect(avatarObjectName({ url: `${BASE}/player-1700000000-ab12.webp?v=123` })).toBe(
      'player-1700000000-ab12.webp',
    )
  })

  it('is null for an empty URL or another bucket', () => {
    expect(avatarObjectName({ url: '' })).toBeNull()
    expect(avatarObjectName({ url: null })).toBeNull()
    expect(
      avatarObjectName({ url: 'http://127.0.0.1:54321/storage/v1/object/public/merch/x.webp' }),
    ).toBeNull()
  })
})

describe('removeAvatar', () => {
  it('removes the stable file and the one an admin uploaded under another name', async () => {
    withPhoto(`${BASE}/player-1700000000-ab12.webp`)
    await removeAvatar({ playerId: 'p1' })

    expect(remove).toHaveBeenCalledWith(['player-p1.webp', 'player-1700000000-ab12.webp'])
  })

  it('removes the stable file once when the URL names it', async () => {
    withPhoto(`${BASE}/player-p1.webp?v=9`)
    await removeAvatar({ playerId: 'p1' })

    expect(remove).toHaveBeenCalledWith(['player-p1.webp'])
  })

  it('throws when storage refuses', async () => {
    remove.mockResolvedValue({ data: null, error: new Error('denied') })

    await expect(removeAvatar({ playerId: 'p1' })).rejects.toThrow('denied')
  })

  it('removes nothing when the photo URL cannot be read', async () => {
    readRow.mockResolvedValue({ data: null, error: new Error('offline') })

    await expect(removeAvatar({ playerId: 'p1' })).rejects.toThrow('offline')
    expect(remove).not.toHaveBeenCalled()
  })
})
