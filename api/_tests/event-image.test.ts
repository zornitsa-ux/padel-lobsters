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

  it('renders the site card, briefly cached, for an unknown event', async () => {
    const res = await handler.fetch(new Request('https://padelobsters.nl/api/event-image?id=nope'))
    expect(ImageResponse).toHaveBeenCalledOnce()
    expect(res.headers.get('cache-control')).toBe('public, max-age=300, s-maxage=300')
  })
})
