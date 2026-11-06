import { afterEach, describe, expect, it, vi } from 'vitest'

const ImageResponse = vi.fn(function (this: Response, _el: unknown, init: ResponseInit) {
  return new Response('png', init)
})
vi.mock('@vercel/og', () => ({ ImageResponse }))

const { default: handler } = await import('../event-image')
const { imageVersion } = await import('../_lib/eventPreview')

const ID = '00000000-0000-4000-b000-000000000101'
const EVENT = {
  id: ID,
  name: 'Sunday mix',
  date: '2099-11-15',
  time: '10:00',
  location: 'Club',
  format: 'americano',
  status: 'upcoming',
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  ImageResponse.mockClear()
})

describe('event-image handler', () => {
  it('renders the current version and caches it hard', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://db.example')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify([EVENT]))),
    )
    const v = imageVersion({ event: EVENT })
    const res = await handler.fetch(
      new Request(`https://padelobsters.nl/api/event-image?id=${ID}&v=${v}`),
    )
    expect(ImageResponse).toHaveBeenCalledOnce()
    expect(res.headers.get('cache-control')).toContain('immutable')
  })

  it('redirects any other version to the current one without rendering', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://db.example')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify([EVENT]))),
    )
    const res = await handler.fetch(
      new Request(`https://padelobsters.nl/api/event-image?id=${ID}&v=made-up`),
    )
    expect(res.status).toBe(308)
    expect(res.headers.get('location')).toBe(
      `https://padelobsters.nl/api/event-image?id=${ID}&v=${imageVersion({ event: EVENT })}`,
    )
    expect(ImageResponse).not.toHaveBeenCalled()
  })

  it('redirects extra query params to the current version without rendering', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://db.example')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify([EVENT]))),
    )
    const v = imageVersion({ event: EVENT })
    const res = await handler.fetch(
      new Request(`https://padelobsters.nl/api/event-image?id=${ID}&v=${v}&x=1`),
    )
    expect(res.status).toBe(308)
    expect(res.headers.get('location')).toBe(
      `https://padelobsters.nl/api/event-image?id=${ID}&v=${v}`,
    )
    expect(ImageResponse).not.toHaveBeenCalled()
  })

  it('sends an unknown or malformed id to the static site image', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://db.example')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('[]')),
    )
    for (const id of ['nope', ID]) {
      const res = await handler.fetch(
        new Request(`https://padelobsters.nl/api/event-image?id=${id}&v=1`),
      )
      expect(res.status).toBe(308)
      expect(res.headers.get('location')).toBe('https://padelobsters.nl/logo-hd.png')
    }
    expect(ImageResponse).not.toHaveBeenCalled()
  })

  it('fails uncached when Supabase fails, so crawlers retry', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://db.example')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('oops', { status: 500 })),
    )
    const res = await handler.fetch(
      new Request(`https://padelobsters.nl/api/event-image?id=${ID}&v=1`),
    )
    expect(res.status).toBe(503)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(ImageResponse).not.toHaveBeenCalled()
  })
})
