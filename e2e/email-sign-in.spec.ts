import { test, expect, type Page } from '@playwright/test'
import { admin } from './fixtures/db'
import { clearInbox, waitForCode, waitForConfirmPath } from './fixtures/mailpit'

/* ════════════════════════════════════════════════════════════════════════════
   Email-code and password sign-in against the local stack. Codes come from
   Mailpit's API. Seeded @lobsters.test players already have auth users.
   ════════════════════════════════════════════════════════════════════════════ */

// Separate players: GoTrue allows one code per address per 60 s.
const CODE_PLAYER = 'ilaria@lobsters.test'
const MODAL_PLAYER = 'ingrid@lobsters.test'
const PASSWORD_PLAYER = 'adriana@lobsters.test'
const LINK_PLAYER = 'erica@lobsters.test'
const RESET_PLAYER = 'favio@lobsters.test'
const TRANSFER_FROM = 'gabriela@lobsters.test'
const TRANSFER_TO = 'francesco@lobsters.test'
const RESET_PASSWORD = 'Reset-Password-2026'
const FIRST_PASSWORD = 'First-Password-2026'
const NEXT_PASSWORD = 'Second-Password-2026'

async function requestCode({ page, email }: { page: Page; email: string }) {
  await clearInbox({ to: email })
  const since = Date.now() - 1000
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: /email me a sign-in code/i }).click()
  await page.getByLabel('Code').waitFor()
  return waitForCode({ to: email, since })
}

async function playerId({ email }: { email: string }): Promise<string> {
  const { data, error } = await admin.from('players').select('id').eq('email', email).single()
  if (error || !data) throw new Error(`No seeded player ${email}`)
  return data.id
}

async function createTransfer(): Promise<string> {
  const { data: tournament } = await admin.from('tournaments').select('id').limit(1).single()
  const { data, error } = await admin
    .from('registration_transfers')
    .insert({
      tournament_id: tournament?.id,
      from_player_id: await playerId({ email: TRANSFER_FROM }),
      to_player_id: await playerId({ email: TRANSFER_TO }),
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`Could not create a transfer: ${error?.message}`)
  return data.id
}

async function enterCode({ page, code }: { page: Page; code: string }) {
  await page.getByLabel('Code').fill(code)
  await page.getByRole('button', { name: /^(sign in|finish signing up)$/i }).click()
}

async function fillSignupForm({ page, email }: { page: Page; email: string }) {
  // A unique name: an existing roster match would block the submit.
  await page.getByPlaceholder('e.g. Augustin').fill('Eve')
  await page.getByPlaceholder('e.g. Tapia').fill(`Nightly${Date.now()}`)
  await page.getByPlaceholder('player@email.com').fill(email)
  await page.getByPlaceholder('+31612345678').fill('+31611111111')
  await page.getByPlaceholder('e.g. 3.5').fill('2.5')
  await page.getByRole('button', { name: /^female$/i }).click()
  await page.getByPlaceholder(/select country/i).fill('Netherlands')
  await page.getByRole('button', { name: /netherlands/i }).click()
}

async function startSignup({ page, email }: { page: Page; email: string }) {
  await page.goto('/events')
  await page.getByRole('button', { name: /sign up/i }).click()
  await fillSignupForm({ page, email })
  await clearInbox({ to: email })
}

test('code sign-in on the page gate stays on the page', async ({ page }) => {
  await page.goto('/events')
  const code = await requestCode({ page, email: CODE_PLAYER })
  await enterCode({ page, code })

  await expect(page.getByLabel('Code')).toBeHidden()
  await expect(page).toHaveURL(/\/events$/)
})

test('code sign-in in the deep-link modal stays on the page', async ({ page }) => {
  await page.goto(`/home?signin=1&email=${MODAL_PLAYER}`)
  await expect(page.getByLabel('Email')).toHaveValue(MODAL_PLAYER)
  await expect(page).toHaveURL(/\/home$/)

  const code = await requestCode({ page, email: MODAL_PLAYER })
  await enterCode({ page, code })

  await expect(page.getByLabel('Code')).toBeHidden()
  await expect(page).toHaveURL(/\/home$/)
})

test('native signup: code creates the players row', async ({ page }) => {
  const email = `e2e-signup-${Date.now()}@lobsters.test`
  await startSignup({ page, email })
  const since = Date.now() - 1000
  await page.getByRole('button', { name: /join the lobsters/i }).click()
  await page.getByLabel('Code').waitFor()

  const { data: before } = await admin.from('players').select('id').eq('email', email)
  expect(before).toHaveLength(0)

  await enterCode({ page, code: await waitForCode({ to: email, since }) })
  await expect(page.getByLabel('Code')).toBeHidden()

  await expect
    .poll(async () => (await admin.from('players').select('name, status').eq('email', email)).data)
    .toMatchObject([{ status: 'active' }])
})

test('signup retry after 60 s: only the newest code works', async ({ page }) => {
  test.setTimeout(150_000)
  const email = `e2e-retry-${Date.now()}@lobsters.test`
  await startSignup({ page, email })
  const submit = page.getByRole('button', { name: /join the lobsters/i })
  const firstSince = Date.now() - 1000
  await submit.click()
  await page.getByLabel('Code').waitFor()
  const firstCode = await waitForCode({ to: email, since: firstSince })

  await page.getByRole('button', { name: /change email/i }).click()
  await submit.click()
  await expect(page.getByText(/please wait \d+ seconds/i)).toBeVisible()

  await page.waitForTimeout(61_000)
  const retrySince = Date.now() - 1000
  await submit.click()
  await page.getByLabel('Code').waitFor()
  const newestCode = await waitForCode({ to: email, since: retrySince })
  expect(newestCode).not.toBe(firstCode)

  await enterCode({ page, code: firstCode })
  await expect(page.getByText(/code didn't work/i)).toBeVisible()
  await enterCode({ page, code: newestCode })
  await expect(page.getByLabel('Code')).toBeHidden()
})

test('password path: set on a code session, sign in with it, change it', async ({ page }) => {
  // A stale Playtomic level pops a modal over the page whenever the profile loads.
  const stalePrompt = page.getByRole('button', { name: /no change/i })
  await page.addLocatorHandler(stalePrompt, (button) => button.click())
  await page.goto('/account')
  const code = await requestCode({ page, email: PASSWORD_PLAYER })
  await enterCode({ page, code })

  await page.getByRole('button', { name: /set or change password/i }).click()
  await expect(page.getByLabel('Current password')).toHaveCount(0)
  await page.getByLabel('New password').fill(FIRST_PASSWORD)
  await page.getByRole('button', { name: /save password/i }).click()
  await expect(page.getByText('Password saved.')).toBeVisible()

  await page.getByRole('button', { name: /^sign out$/i }).click()
  await page.getByRole('button', { name: /sign in with password/i }).click()
  await page.getByLabel('Email').fill(PASSWORD_PLAYER)
  await page.getByLabel('Password').fill(FIRST_PASSWORD)
  await page.getByRole('button', { name: /^sign in$/i }).click()

  await page.getByRole('button', { name: /change password/i }).click()
  await expect(page.getByLabel('Current password')).toBeVisible()
  await page.getByLabel('Current password').fill(FIRST_PASSWORD)
  await page.getByLabel('New password').fill(NEXT_PASSWORD)
  await page.getByRole('button', { name: /save password/i }).click()
  await expect(page.getByText('Password saved.')).toBeVisible()
})

test('magic link: tap to confirm returns to the page it was requested from', async ({ page }) => {
  await page.goto('/events')
  await clearInbox({ to: LINK_PLAYER })
  const since = Date.now() - 1000
  await page.getByLabel('Email').fill(LINK_PLAYER)
  await page.getByRole('button', { name: /email me a sign-in code/i }).click()
  await page.getByLabel('Code').waitFor()

  await page.goto(await waitForConfirmPath({ to: LINK_PLAYER, since }))
  await page.getByRole('button', { name: /tap to finish signing in/i }).click()

  await expect(page).toHaveURL(/\/events$/)
  await expect(page.getByLabel('Email')).toHaveCount(0)
})

test('forgot password: reset code, rule messages, new password signs in', async ({ page }) => {
  const stalePrompt = page.getByRole('button', { name: /no change/i })
  await page.addLocatorHandler(stalePrompt, (button) => button.click())
  await page.goto('/events')
  await page.getByRole('button', { name: /sign in with password/i }).click()
  await page.getByRole('button', { name: /forgot password/i }).click()
  await clearInbox({ to: RESET_PLAYER })
  const since = Date.now() - 1000
  await page.getByLabel('Email').fill(RESET_PLAYER)
  await page.getByRole('button', { name: /send reset code/i }).click()
  await page.getByLabel('Code').fill(await waitForCode({ to: RESET_PLAYER, since }))
  await page.getByRole('button', { name: /^continue$/i }).click()

  await expect(page.getByRole('heading', { name: /set a new password/i })).toBeVisible()
  const save = page.getByRole('button', { name: /save password/i })
  await page.getByLabel('New password').fill('Short1')
  await save.click()
  await expect(page.getByText(/needs at least 10 characters/i)).toBeVisible()
  await page.getByLabel('New password').fill('alllowercase1234')
  await save.click()
  await expect(
    page.getByText(/add a lowercase letter, an uppercase letter and a digit/i),
  ).toBeVisible()
  await page.getByLabel('New password').fill(RESET_PASSWORD)
  await save.click()
  await expect(page).toHaveURL(/\/events$/)

  await page.goto('/account')
  await page.getByRole('button', { name: /^sign out$/i }).click()
  await page.getByRole('button', { name: /sign in with password/i }).click()
  await page.getByLabel('Email').fill(RESET_PLAYER)
  await page.getByLabel('Password').fill(RESET_PASSWORD)
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await expect(page.getByRole('button', { name: /^sign in$/i })).toHaveCount(0)
  await expect(page).toHaveURL(/\/account$/)
})

test('signed-out transfer deep link: code sign-in lands on the transfer', async ({ page }) => {
  const transferId = await createTransfer()
  try {
    await page.goto(`/transfer/${transferId}`)
    const code = await requestCode({ page, email: TRANSFER_TO })
    await enterCode({ page, code })

    await expect(page).toHaveURL(new RegExp(`/transfer/${transferId}$`))
    await expect(page.getByText(/wants to transfer their spot to you/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /accept transfer/i })).toBeVisible()
  } finally {
    await admin.from('registration_transfers').delete().eq('id', transferId)
  }
})
