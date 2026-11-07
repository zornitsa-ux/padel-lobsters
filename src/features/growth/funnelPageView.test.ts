import { describe, expect, it } from 'vitest'
import { funnelPageView } from './funnelPageView'

const origin = 'https://padelobsters.nl'
const view = (path: string, signedIn = false) => funnelPageView({ url: origin + path, signedIn })

describe('funnelPageView', () => {
  it('sends the signed-out funnel pages', () => {
    for (const path of [
      '/',
      '/home',
      '/events',
      '/events/42',
      '/events/42/info',
      '/events/42/join',
    ]) {
      expect(view(path)).toBe(origin + path)
    }
  })

  it('drops the query string, hash and a trailing slash', () => {
    expect(view('/events/42/join?signup=1&signin=1&email=a%40b.nl#top')).toBe(
      `${origin}/events/42/join`,
    )
    expect(view('/events/42/')).toBe(`${origin}/events/42`)
  })

  it('sends nothing for a signed-in member', () => {
    expect(view('/events/42/info', true)).toBeNull()
  })

  it('sends nothing for auth links or member pages', () => {
    for (const path of [
      '/auth/confirm?token_hash=x&type=magiclink',
      '/events/42/results',
      '/events/42/me',
      '/community',
      '/account',
      '/transfer/9',
    ]) {
      expect(view(path)).toBeNull()
    }
  })

  it('sends nothing for an unparseable URL', () => {
    expect(funnelPageView({ url: 'not a url', signedIn: false })).toBeNull()
  })
})
