import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockSupabase } from '../../test/mockSupabase'

const h = vi.hoisted(() => ({
  uploads: [] as { bucket: string; filename: string; options: unknown }[],
  uploadResult: { current: { error: null as unknown } },
}))

vi.mock('../../supabase', () =>
  mockSupabase({
    storage: {
      from: (bucket: string) => ({
        upload: (filename: string, _file: Blob, options: unknown) => {
          h.uploads.push({ bucket, filename, options })
          return Promise.resolve(h.uploadResult.current)
        },
        getPublicUrl: (filename: string) => ({
          data: { publicUrl: `https://cdn.test/${bucket}/${filename}` },
        }),
      }),
    },
  }),
)

import { randomAvatarFilename, uploadAvatar } from './playerQueries'

beforeEach(() => {
  h.uploads.length = 0
  h.uploadResult.current = { error: null }
})

describe('uploadAvatar', () => {
  const file = new Blob(['x'], { type: 'image/webp' })

  it('uploads to the avatars bucket and returns the public URL', async () => {
    const url = await uploadAvatar({ file, filename: 'player-1.webp' })

    expect(h.uploads[0]).toMatchObject({ bucket: 'avatars', filename: 'player-1.webp' })
    expect(url).toBe('https://cdn.test/avatars/player-1.webp')
  })

  it('upserts as image/webp so a re-upload replaces the stored file', async () => {
    await uploadAvatar({ file, filename: 'player-1.webp' })

    expect(h.uploads[0].options).toEqual({ upsert: true, contentType: 'image/webp' })
  })

  it('throws when the bucket rejects the upload', async () => {
    const err = { message: 'bucket missing' }
    h.uploadResult.current = { error: err }

    await expect(uploadAvatar({ file, filename: 'player-1.webp' })).rejects.toBe(err)
  })
})

describe('randomAvatarFilename', () => {
  it('produces a distinct .webp name per call', () => {
    const a = randomAvatarFilename()
    const b = randomAvatarFilename()

    expect(a).toMatch(/^player-\d+-[a-z0-9]+\.webp$/)
    expect(a).not.toBe(b)
  })
})
