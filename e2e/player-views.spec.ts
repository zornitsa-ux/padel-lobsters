import type { Page } from '@playwright/test'
import { ADMIN, PLAYER, SEED_EVENTS, SEED_LEAGUE, SEED_MERCH } from './fixtures/seed'
import { SESSION_FILES } from './fixtures/sessions'
import { expect, test } from './fixtures/test'

/* ════════════════════════════════════════════════════════════════════════════
   Every page a player reaches, signed out and signed in, against the seeded
   world (supabase/seed.sql). Each check reads seeded data, so a page that
   renders but loads nothing fails. Read-only: nothing here writes.
   ════════════════════════════════════════════════════════════════════════════ */

const { social, opener, pairs, kingOfCourt } = SEED_EVENTS

// The next event on Home isn't always the seeded one: the run-of-show spec runs
// an event dated today alongside. So Home checks that an event loaded.
async function expectNextEvent({ page }: { page: Page }) {
  await expect(page.getByText('Next Lobster Event in')).toBeVisible()
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible()
}

test.describe('signed out', () => {
  test('Home shows the next event and the league', async ({ page }) => {
    await page.goto('/home')
    await expect(page.getByText('Welcome to Padel Lobsters!')).toBeVisible()
    await expectNextEvent({ page })
    await expect(page.getByRole('heading', { name: SEED_LEAGUE.name })).toBeVisible()
  })

  const protectedPaths = [
    '/events',
    `/events/${social.id}`,
    '/community',
    '/community/shop',
    '/league',
    '/lobster-way',
    '/account',
    '/admin',
  ]
  for (const path of protectedPaths) {
    test(`${path} asks to sign in`, async ({ page }) => {
      await page.goto(path)
      await expect(page.getByRole('button', { name: /email me a sign-in code/i })).toBeVisible()
    })
  }
})

test.describe('player', () => {
  test.use({ storageState: SESSION_FILES.player })

  test('Home greets the player and shows their next event', async ({ page }) => {
    await page.goto('/home')
    await expect(page.getByText(`${PLAYER.name.split(' ')[0]}!`)).toBeVisible()
    await expectNextEvent({ page })
    await expect(page.getByRole('heading', { name: SEED_LEAGUE.name })).toBeVisible()
  })

  test('Events lists the upcoming events and the past one', async ({ page }) => {
    await page.goto('/events')
    for (const event of [social, pairs, kingOfCourt]) {
      await expect(page.getByRole('heading', { name: event.name })).toBeVisible()
    }
    await expect(page.getByRole('button', { name: new RegExp(opener.name) })).toBeVisible()
  })

  test('individual event: Info, You and Schedule', async ({ page }) => {
    await page.goto(`/events/${social.id}`)
    await expect(page).toHaveURL(/\/info$/)
    await expect(page.getByRole('heading', { name: 'Registered (12/16)' })).toBeVisible()
    await expect(page.getByText("You're registered")).toBeVisible()

    await page.getByRole('link', { name: 'You' }).click()
    await expect(page.getByText(/Pay to lock your spot · €10\.00/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Pay via Tikkie' })).toBeVisible()

    await page.goto(`/events/${social.id}/schedule`)
    await expect(page.getByText('No schedule generated yet')).toBeVisible()
  })

  test('finished event: standings, matches and the Oscars', async ({ page }) => {
    await page.goto(`/events/${opener.id}`)
    await expect(page).toHaveURL(/\/results$/)
    await expect(page.getByRole('heading', { name: 'Podium' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Full Standings' })).toBeVisible()

    await page.goto(`/events/${opener.id}/oscars`)
    await expect(page.getByRole('heading', { name: /The Results/ })).toBeVisible()
    await expect(page.getByText('Best Lobster')).toBeVisible()
  })

  test('team event: the pair on You, the teams on Info', async ({ page }) => {
    await page.goto(`/events/${pairs.id}/me`)
    await expect(page.getByText('You & Lena Voss')).toBeVisible()
    await expect(page.getByText(/Your team is registered/)).toBeVisible()

    await page.goto(`/events/${kingOfCourt.id}/info`)
    await expect(page.getByRole('heading', { name: 'Registered (4/6 teams)' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign up as a team' })).toBeVisible()
  })

  test('Community: the roster and a player page', async ({ page }) => {
    await page.goto('/community')
    await expect(page.getByRole('heading', { name: /^Players \(\d+\)$/ })).toBeVisible()
    await expect(page.getByText(ADMIN.name.split(' ')[0], { exact: true })).toBeVisible()

    await page.goto(`/community/${PLAYER.id}`)
    await expect(page.getByText(PLAYER.name)).toBeVisible()
    // The run-of-show spec adds a finished event for this player, so no counts.
    await expect(page.getByText(/\d+ played · \d+W \d+L/)).toBeVisible()
    await expect(page.getByRole('button', { name: opener.name })).toBeVisible()
  })

  test('Shop lists the items', async ({ page }) => {
    await page.goto('/community/shop')
    for (const item of SEED_MERCH) await expect(page.getByText(item, { exact: true })).toBeVisible()
  })

  test('League: standings, group stage and seasons', async ({ page }) => {
    await page.goto('/league')
    await expect(page).toHaveURL(new RegExp(`/league/${SEED_LEAGUE.id}$`))
    await expect(page.getByRole('heading', { name: SEED_LEAGUE.name })).toBeVisible()
    await expect(
      page.getByRole('row', { name: new RegExp(`#1 ${SEED_LEAGUE.playerTeam}`) }),
    ).toBeVisible()
    await page.getByRole('button', { name: "Women's" }).click()
    await expect(page.getByRole('row', { name: /#1 Smash Sisters/ })).toBeVisible()

    await page.goto(`/league/${SEED_LEAGUE.id}/group-stage`)
    await expect(page.getByRole('heading', { name: 'Group Stage' })).toBeVisible()

    await page.goto('/league/seasons')
    await expect(page.getByText(SEED_LEAGUE.name)).toBeVisible()
  })

  test('Lobster Way', async ({ page }) => {
    await page.goto('/lobster-way')
    await expect(page.getByRole('heading', { name: 'Getting started' })).toBeVisible()
  })

  test('Account: profile, sign-in settings and orders', async ({ page }) => {
    await page.goto('/account')
    await expect(page.getByText(PLAYER.email)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Sign-in & security' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /My Lobster Profile/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: /My Orders/ })).toBeVisible()
  })

  test('admin pages and tabs stay closed', async ({ page }) => {
    for (const path of ['/admin', '/admin/lobster-way']) {
      await page.goto(path)
      await expect(page.getByText('Admin sign-in required')).toBeVisible()
    }
    await page.goto(`/events/${social.id}/manage`)
    await expect(page).toHaveURL(/\/info$/)
    await expect(page.getByRole('link', { name: 'Manage' })).toHaveCount(0)
    await page.goto(`/league/${SEED_LEAGUE.id}/manage`)
    await expect(page).toHaveURL(new RegExp(`/league/${SEED_LEAGUE.id}$`))
  })
})
