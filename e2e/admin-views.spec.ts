import { rowWith } from './fixtures/locators'
import { SEED_EVENTS, SEED_LEAGUE, SEED_MERCH } from './fixtures/seed'
import { SESSION_FILES } from './fixtures/sessions'
import { expect, test } from './fixtures/test'

/* ════════════════════════════════════════════════════════════════════════════
   Every admin page, as the seeded admin, against the seeded world. Read-only:
   what an admin writes is in admin-flows. That a player can't reach these
   pages is checked in player-views.
   ════════════════════════════════════════════════════════════════════════════ */

test.use({ storageState: SESSION_FILES.admin })

test('Admin shows what needs attention and every section', async ({ page }) => {
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Admin', level: 1 })).toBeVisible()
  await expect(page.getByText('Needs attention')).toBeVisible()
  await expect(page.getByRole('button', { name: /new merch orders/ })).toBeVisible()
  await expect(page.getByText(/Sign-in readiness/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Lobster Review Breakdown/ })).toBeVisible()
  for (const section of [
    'Player Approvals',
    'Ratings & Admin Settings',
    'Merch Admin',
    'The Lobster Way',
    'League',
  ]) {
    await expect(page.getByRole('link', { name: new RegExp(`^${section} `) })).toBeVisible()
  }
})

test('event Manage opens each section', async ({ page }) => {
  await page.goto(`/events/${SEED_EVENTS.social.id}/manage`)
  await expect(page.getByRole('heading', { name: SEED_EVENTS.social.name })).toBeVisible()
  await expect(page.getByText('Registered', { exact: true })).toBeVisible()
  await expect(page.getByText('No schedule yet')).toBeVisible()

  await page.getByRole('button', { name: 'Payments', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Payment status' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mark Paid' }).first()).toBeVisible()

  await page.getByRole('button', { name: 'Raffle', exact: true }).click()
  await expect(page.getByText('Prize Raffle')).toBeVisible()
  await expect(page.getByRole('button', { name: '🎲 Draw winner' })).toBeVisible()

  // Exact: the Raffle section has a "Manage eligibility" button too.
  await page.getByRole('button', { name: 'Eligibility', exact: true }).click()
  await expect(page.getByText('10 of 12 eligible · 2 on cooldown')).toBeVisible()
})

test('league Manage shows the season and its matches', async ({ page }) => {
  const { team1, team2 } = SEED_LEAGUE.pendingMatch
  await page.goto(`/league/${SEED_LEAGUE.id}/manage`)
  await expect(page.getByRole('heading', { name: SEED_LEAGUE.name })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Season phase' })).toBeVisible()

  await page.getByRole('button', { name: 'Teams' }).click()
  await expect(page.getByText('Teams (5)')).toBeVisible()
  await expect(rowWith({ scope: page, texts: [team1.name], button: 'Remove' })).toBeVisible()

  await page.getByRole('button', { name: 'Matches' }).click()
  await expect(page.getByText('Pending Matches (1)')).toBeVisible()
  await expect(
    rowWith({ scope: page, texts: [team1.name, team2.name], button: 'Enter Score' }),
  ).toBeVisible()
  await expect(page.getByText('Results (3)')).toBeVisible()
})

test('shop Manage lists the items', async ({ page }) => {
  await page.goto('/community/shop')
  await page.getByRole('button', { name: '⚙️ Manage' }).click()
  await expect(page.getByRole('button', { name: 'Add Merch Item' })).toBeVisible()
  for (const item of SEED_MERCH) {
    await expect(page.getByRole('button', { name: `Edit ${item}` })).toBeVisible()
  }
  // No fixed count: player-flows places and removes an order alongside.
  await page.getByRole('button', { name: /Orders/ }).click()
  await expect(page.getByText(/^\d+ orders$/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mark Delivered' }).first()).toBeVisible()
})

test('Lobster Way admin lists the categories', async ({ page }) => {
  await page.goto('/admin/lobster-way')
  await expect(page.getByRole('heading', { name: 'Edit The Lobster way' })).toBeVisible()
  await expect(page.getByRole('button', { name: '🦞 Origin story' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible()
})
