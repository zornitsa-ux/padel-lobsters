import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from '../event-preview'

const ID = '00000000-0000-4000-b000-000000000101'

const mockFetch = (rows: unknown[]) => {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(rows), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('event-preview handler', () => {
  it("serves the event's tags, reading only event facts", async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://db.example')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon')
    const fetchMock = mockFetch([
      {
        id: ID,
        name: 'Sunday mix',
        date: '2099-11-15',
        time: '10:00',
        location: 'Club',
        format: 'lobster_matching',
        status: 'upcoming',
      },
    ])

    const res = await handler(
      new Request(`https://padelobsters.nl/api/event-preview?id=${ID}&tab=info&src=wa`),
    )
    const html = await res.text()
    expect(html).toContain(
      `location.replace("https://padelobsters.nl/events/${ID}/info?src=wa&app=1")`,
    )
    expect(html).toContain('See the details and join')

    expect(res.headers.get('content-type')).toContain('text/html')
    expect(html).toContain('<meta property="og:title" content="Sunday mix" />')
    expect(html).toContain(`content="https://padelobsters.nl/events/${ID}/info"`)
    expect(html).toMatch(new RegExp(`/api/event-image\\?id=${ID}&#38;v=\\w+`))
    const [url] = fetchMock.mock.calls[0] as unknown as [string]
    expect(url).toContain('select=id,name,date,time,location,format,status')
    expect(url).toContain(`id=eq.${ID}`)
  })

  it('falls back to the site tags when Supabase is unreachable or unset', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://db.example')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('offline'))),
    )
    const res = await handler(new Request(`https://padelobsters.nl/api/event-preview?id=${ID}`))
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<meta property="og:title" content="Padel Lobsters" />')

    vi.stubEnv('VITE_SUPABASE_URL', '')
    const unset = await handler(new Request(`https://padelobsters.nl/api/event-preview?id=${ID}`))
    expect(await unset.text()).toContain('<meta property="og:title" content="Padel Lobsters" />')
  })

  it('falls back to the site tags for an unknown or malformed id', async () => {
    const fetchMock = mockFetch([])
    const bad = await handler(new Request('https://padelobsters.nl/api/event-preview?id=nope'))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await bad.text()).toContain('<meta property="og:title" content="Padel Lobsters" />')

    const missing = await handler(new Request(`https://padelobsters.nl/api/event-preview?id=${ID}`))
    expect(await missing.text()).toContain('content="https://padelobsters.nl/logo-hd.png"')
  })
})
