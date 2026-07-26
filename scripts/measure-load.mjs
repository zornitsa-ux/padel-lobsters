#!/usr/bin/env node
// ============================================================================
//  measure-load.mjs — real load-time measurement (dev-only)
//
//  Lighthouse (`npm run lhci`) scores the app shell, which paints before any
//  session or data exists — it reports ~1.0 while the home screen is still
//  empty. It also runs signed-out against whichever Supabase the build picked
//  up, so it can never see the auth + data phase that users actually wait on.
//
//  This drives a real Chrome at the preview build (or any deployed URL) and
//  reports the src/lib/perfMarks.ts milestones alongside the request waterfall,
//  so the numbers cover boot → session → first query → content.
//
//  Usage:
//    node scripts/measure-load.mjs <url> [mobile]
//
//    node scripts/measure-load.mjs http://127.0.0.1:4173/home?perf=1
//    node scripts/measure-load.mjs https://padelobsters.nl/home?perf=1 mobile
//
//  `mobile` applies Lighthouse's slow-4G + 4x CPU throttling. Without it you
//  are measuring a desktop on fibre, which is not where the complaints come
//  from.
//
//  The URL needs ?perf=1 (or localStorage.pl_perf = '1') for the marks to be
//  recorded in a production build.
//
//  Signed-out by default. To measure the signed-in path — the one that shows
//  the auth serialisation — run it against a Chrome profile that already has a
//  session, or read the same table from your own device's console, which is
//  printed automatically when ?perf=1 is set.
// ============================================================================

import puppeteer from 'puppeteer-core'
import { Launcher } from 'chrome-launcher'

const url = process.argv[2]
const throttle = process.argv[3] === 'mobile'

if (!url) {
  console.error('usage: node scripts/measure-load.mjs <url> [mobile]')
  process.exit(1)
}

const browser = await puppeteer.launch({
  executablePath: Launcher.getFirstInstallation(),
  headless: 'new',
})
const page = await browser.newPage()

if (throttle) {
  const cdp = await page.createCDPSession()
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
}

const requests = []
page.on('response', (r) => {
  const u = r.url()
  if (!/\/rest\/v1\/|\/auth\/v1\/|\.js|\.css|\.webp|\.png/.test(u)) return
  requests.push({
    method: r.request().method(),
    url: u.replace(/^https?:\/\/[^/]+/, '').slice(0, 64),
    status: r.status(),
  })
})

await page.goto(url, { waitUntil: 'networkidle0', timeout: 60_000 })
await new Promise((r) => setTimeout(r, 2000))

const marks = await page.evaluate(() => globalThis.__plPerf?.timeline?.() ?? null)
const paint = await page.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0]
  const paints = Object.fromEntries(
    performance.getEntriesByType('paint').map((p) => [p.name, Math.round(p.startTime)]),
  )
  const bytes = performance
    .getEntriesByType('resource')
    .reduce((sum, r) => sum + (r.transferSize || 0), 0)
  return {
    domContentLoaded: Math.round(nav.domContentLoadedEventEnd),
    ...paints,
    transferredKB: Math.round(bytes / 1024),
  }
})

console.log(`\n${throttle ? 'slow 4G + 4x CPU' : 'unthrottled'} — ${url}`)
console.log('\n=== paint + bytes ===')
console.table([paint])
console.log('\n=== load milestones (ms since navigation start) ===')
if (marks?.length) console.table(marks)
else console.log('no marks recorded — is ?perf=1 set?')
console.log('\n=== requests ===')
console.table(requests)

await browser.close()
