import type { Page } from '@playwright/test'
import { signIn } from './fixtures/auth'
import {
  admin,
  createPlayer,
  deletePlayer,
  deletePlayerByEmail,
  PLAYER_PASSWORD,
} from './fixtures/db'
import { clearInbox, waitForCode, waitForConfirmPath } from './fixtures/mailpit'
import { SEED_EVENTS, SIGN_IN_EMAILS } from './fixtures/seed'
import { allowConsoleErrors, expect, test } from './fixtures/test'

/* ════════════════════════════════════════════════════════════════════════════
   Email-code and password sign-in against the local stack. Codes come from
   Mailpit's API. Seeded @lobsters.test players already have auth users.
   ════════════════════════════════════════════════════════════════════════════ */

// Separate players: GoTrue allows one code per address per 60 s.
const {
  code: CODE_PLAYER,
  modal: MODAL_PLAYER,
  password: PASSWORD_PLAYER,
  link: LINK_PLAYER,
  reset: RESET_PLAYER,
  transferFrom: TRANSFER_FROM,
  transferTo: TRANSFER_TO,
} = SIGN_IN_EMAILS
// Unique per run: GoTrue rejects a new password equal to the current one, and
// these accounts keep the last run's.
const RUN = Date.now()
const RESET_PASSWORD = `Reset-Password-${RUN}`
const FIRST_PASSWORD = `First-Password-${RUN}`
const NEXT_PASSWORD = `Second-Password-${RUN}`

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
  const { data, error } = await admin
    .from('registration_transfers')
    .insert({
      tournament_id: SEED_EVENTS.social.id,
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

const signedUp: string[] = []

test.afterEach(async () => {
  for (const email of signedUp.splice(0)) await deletePlayerByEmail({ email })
})

async function startSignup({ page, email }: { page: Page; email: string }) {
  signedUp.push(email)
  await page.goto('/community')
  await page.getByRole('button', { name: /sign up/i }).click()
  await fillSignupForm({ page, email })
  await clearInbox({ to: email })
}

test('code sign-in on the page gate stays on the page', async ({ page }) => {
  await page.goto('/community')
  const code = await requestCode({ page, email: CODE_PLAYER })
  await enterCode({ page, code })

  await expect(page.getByLabel('Code')).toBeHidden()
  await expect(page).toHaveURL(/\/community$/)
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
  // Reload and wait for the check's own-profile read, so the assertion can't run before it settles.
  const ownProfileRead = page.waitForResponse((res) => res.url().includes('get_my_profile_v2'))
  await page.reload()
  await ownProfileRead
  await page.waitForLoadState('networkidle')
  await expect(page.getByLabel('Code')).toBeHidden()
  await expect(page.getByText(/your account isn.t fully set up/i)).toHaveCount(0)
})

test('signup retry after 60 s: only the newest code works', async ({ page }) => {
  allowConsoleErrors({
    page,
    patterns: [/status of 429 .*\/auth\/v1\/otp/, /status of 403 .*\/auth\/v1\/verify/],
  })
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
  await page.goto('/account')
  const code = await requestCode({ page, email: PASSWORD_PLAYER })
  await enterCode({ page, code })

  await page.getByRole('button', { name: /set or change password/i }).click()
  await expect(page.getByLabel('Current password')).toHaveCount(0)
  await page.getByLabel('New password').fill(FIRST_PASSWORD)
  await page.getByRole('button', { name: /save password/i }).click()
  await expect(page.getByText('Password saved.')).toBeVisible()

  await page.getByRole('button', { name: /^sign out$/i }).click()
  await signIn({ page, email: PASSWORD_PLAYER, password: FIRST_PASSWORD })

  await page.getByRole('button', { name: /change password/i }).click()
  await expect(page.getByLabel('Current password')).toBeVisible()
  await page.getByLabel('Current password').fill(FIRST_PASSWORD)
  await page.getByLabel('New password').fill(NEXT_PASSWORD)
  await page.getByRole('button', { name: /save password/i }).click()
  await expect(page.getByText('Password saved.')).toBeVisible()
})

test('magic link: tap to confirm returns to the page it was requested from', async ({ page }) => {
  await page.goto('/community')
  await clearInbox({ to: LINK_PLAYER })
  const since = Date.now() - 1000
  await page.getByLabel('Email').fill(LINK_PLAYER)
  await page.getByRole('button', { name: /email me a sign-in code/i }).click()
  await page.getByLabel('Code').waitFor()

  await page.goto(await waitForConfirmPath({ to: LINK_PLAYER, since }))
  await page.getByRole('button', { name: /tap to finish signing in/i }).click()

  await expect(page).toHaveURL(/\/community$/)
  await expect(page.getByLabel('Email')).toHaveCount(0)
})

test('forgot password: reset code, rule messages, new password signs in', async ({ page }) => {
  allowConsoleErrors({ page, patterns: [/status of 422 .*\/auth\/v1\/user/] })
  await page.goto('/community')
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
  await expect(page).toHaveURL(/\/community$/)

  await page.goto('/account')
  await page.getByRole('button', { name: /^sign out$/i }).click()
  await signIn({ page, email: RESET_PLAYER, password: RESET_PASSWORD })
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

test('an account with no players row sees the incomplete-account panel and can sign out', async ({
  page,
}) => {
  allowConsoleErrors({ page, patterns: [/\[auth\] incomplete session/] })
  const email = `e2e-orphan-${Date.now()}@lobsters.test`
  // No name metadata: the C-4 trigger skips the players row.
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (error || !data.user) throw new Error(`Could not create the orphan user: ${error?.message}`)
  try {
    await page.goto(`/home?signin=1&email=${email}`)
    const code = await requestCode({ page, email })
    await enterCode({ page, code })

    await expect(page.getByText(/your account isn.t fully set up/i)).toBeVisible()
    await page.getByRole('button', { name: /^sign out$/i }).click()
    await expect(page.getByText(/your account isn.t fully set up/i)).toHaveCount(0)
  } finally {
    await admin.auth.admin.deleteUser(data.user.id)
  }
})

/* ════════════════════════════════════════════════════════════════════════════
   After the PIN cutover: the explainer and the Home add-email card.
   ════════════════════════════════════════════════════════════════════════════ */

async function openHomeSignedIn({ page, email }: { page: Page; email: string }) {
  await signIn({ page, email, password: PLAYER_PASSWORD, at: '/community' })
  await page.goto('/home')
}

test('sign-in offers no PIN, only the retired-PIN explainer', async ({ page }) => {
  await page.goto('/community')
  await expect(page.getByRole('button', { name: /sign in with pin/i })).toHaveCount(0)
  await page.getByRole('button', { name: /used a pin before\?/i }).click()
  await expect(page.getByText(/^PINs have retired\./)).toBeVisible()
})

test('synthetic account sees the add-email card until an admin sets a real email', async ({
  page,
}) => {
  const synthetic = `player-${crypto.randomUUID()}@padelobsters.internal`
  const realEmail = `e2e-fixed-${Date.now()}@lobsters.test`
  const { id } = await createPlayer({ email: synthetic })
  try {
    await openHomeSignedIn({ page, email: synthetic })
    const card = page.getByTestId('add-email-card')
    await expect(card).toContainText('Add your email so you can keep signing in')
    await expect(card.getByRole('button')).toHaveCount(0)
    await expect(page.getByText('padelobsters.internal')).toHaveCount(0)

    const { error } = await admin.from('players').update({ email: realEmail }).eq('id', id)
    if (error) throw new Error(`Could not set the real email: ${error.message}`)
    await expect
      .poll(async () => (await admin.auth.admin.getUserById(id)).data.user?.email)
      .toBe(realEmail)

    await page.goto('/account')
    await page.getByRole('button', { name: /^sign out$/i }).click()
    await signIn({ page, email: realEmail, password: PLAYER_PASSWORD })
    await page.goto('/home')
    await expect(page.getByTestId('add-email-card')).toHaveCount(0)
  } finally {
    await deletePlayer({ id })
  }
})
