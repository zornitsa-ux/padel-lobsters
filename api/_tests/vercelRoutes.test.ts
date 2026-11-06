import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

interface Rewrite {
  source: string
  destination: string
  has?: { type: string; key: string; value: string }[]
}

const { rewrites } = JSON.parse(
  readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'),
) as { rewrites: Rewrite[] }
const crawlerRules = rewrites.filter((r) => r.has?.some((h) => h.key === 'user-agent'))
const crawlerUa = new RegExp(crawlerRules[0].has![0].value)

describe('vercel.json crawler routes', () => {
  it('covers the event index and info paths, before the app catch-all', () => {
    expect(crawlerRules.map((r) => r.source)).toEqual(['/events/:id', '/events/:id/info'])
    expect(rewrites.at(-1)?.source).toBe('/((?!api/).*)')
    // Two rules, one regex: keep them identical.
    expect(new Set(crawlerRules.map((r) => r.has![0].value)).size).toBe(1)
  })

  it('tells the preview which tab was opened', () => {
    expect(crawlerRules.map((r) => r.destination)).toEqual([
      '/api/event-preview?id=:id',
      '/api/event-preview?id=:id&tab=info',
    ])
  })

  it('leaves out search crawlers, which should index the app', () => {
    expect(
      crawlerUa.test('Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)'),
    ).toBe(false)
  })

  it.each([
    'WhatsApp/2.23.20.0 A',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
    'TelegramBot (like TwitterBot)',
    'Twitterbot/1.0',
  ])('matches the link-preview crawler %s', (ua) => {
    expect(crawlerUa.test(ua)).toBe(true)
  })

  it.each([
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/440.0]',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  ])('leaves people in in-app and normal browsers on the app: %s', (ua) => {
    expect(crawlerUa.test(ua)).toBe(false)
  })
})

// Vercel deploys every file in api/ not under an `_` folder as a function, so
// tests and helpers must stay in api/_tests and api/_lib.
it('keeps only function entry points at the top of api/', () => {
  const entries = readdirSync(new URL('..', import.meta.url)).filter((f) => !f.startsWith('_'))
  expect(entries.sort()).toEqual(['event-image.tsx', 'event-preview.ts'])
})

// Vercel runs functions as plain Node ES modules, which need file extensions on
// relative imports. Without them a function builds but fails on its first call.
it('gives every relative import in the functions a file extension', () => {
  const files = ['.', '_lib'].flatMap((dir) =>
    readdirSync(new URL(`../${dir}/`, import.meta.url))
      .filter((f) => /\.tsx?$/.test(f))
      .map((f) => new URL(`../${dir}/${f}`, import.meta.url)),
  )
  const bare = files.flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(/from '(\.{1,2}\/[^']+)'/g)]
      .map((m) => m[1])
      .filter((spec) => !/\.(js|json)$/.test(spec)),
  )
  expect(bare).toEqual([])
})
