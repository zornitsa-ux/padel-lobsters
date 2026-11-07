import type { Page } from '@playwright/test'
import {
  admin,
  cleanUp,
  createEvent,
  createPlayer,
  deleteEvent,
  deletePlayer,
  deletePlayerByEmail,
  registerPlayers,
  registrationOf,
} from './fixtures/db'
import { clearInbox, waitForCode, waitForConfirmPath } from './fixtures/mailpit'
import { SEED_PLAYERS } from './fixtures/seed'
import { fillSignupForm } from './fixtures/signup'
import { expect, test } from './fixtures/test'

/* ════════════════════════════════════════════════════════════════════════════
   G3: a signed-out visitor opens a shared event, joins, and lands back on the
   event with its sign-up action on screen. Phone-sized, because that's where
   shared links are opened and where the action used to sit below the fold.
   ════════════════════════════════════════════════════════════════════════════ */

test.use({ viewport: { width: 375, height: 667 } })

const newEmail = (label: string) => `e2e-g3-${label}-${Date.now()}@lobsters.test`

/** Signs up from the guest event page; returns when the code has been asked for. */
async function joinAsNewPlayer({
  page,
  eventId,
  email,
  cta,
}: {
  page: Page
  eventId: string
  email: string
  cta: RegExp
}): Promise<number> {
  await page.goto(`/events/${eventId}`)
  await page.getByRole('link', { name: cta }).click()
  await fillSignupForm({ page, email })
  await clearInbox({ to: email })
  const since = Date.now() - 1000
  await page.getByRole('button', { name: /join the lobsters/i }).click()
  await page.getByLabel('Code').waitFor()
  return since
}

async function enterCode({ page, email, since }: { page: Page; email: string; since: number }) {
  await page.getByLabel('Code').fill(await waitForCode({ to: email, since }))
  await page.getByRole('button', { name: /^(sign in|finish signing up)$/i }).click()
}

async function expectOnEventWithAction({
  page,
  eventId,
  action,
}: {
  page: Page
  eventId: string
  action: RegExp
}) {
  await expect(page).toHaveURL(new RegExp(`/events/${eventId}/info$`))
  await expect(page.getByRole('button', { name: action })).toBeInViewport()
}

async function playerIdByEmail({ email }: { email: string }): Promise<string> {
  const { data, error } = await admin.from('players').select('id').eq('email', email).single()
  if (error || !data) throw new Error(`No player for ${email}`)
  return data.id
}

test('new account: code signup lands on the event and registers in one tap', async ({ page }) => {
  const event = await createEvent()
  const email = newEmail('code')
  try {
    const since = await joinAsNewPlayer({ page, eventId: event.id, email, cta: /join to play/i })
    await enterCode({ page, email, since })

    await expectOnEventWithAction({ page, eventId: event.id, action: /register for this event/i })
    await page.getByRole('button', { name: /register for this event/i }).click()
    await expect(page.getByText(/you.re registered/i)).toBeVisible()
    const playerId = await playerIdByEmail({ email })
    expect(await registrationOf({ eventId: event.id, playerId, columns: 'status' })).toEqual({
      status: 'registered',
    })
  } finally {
    await cleanUp(
      () => deleteEvent({ id: event.id }),
      () => deletePlayerByEmail({ email }),
    )
  }
})

test('new account: the email link opened in another browser lands on the event', async ({
  page,
  browser,
}) => {
  const event = await createEvent()
  const email = newEmail('link')
  const other = await browser.newPage({ viewport: { width: 375, height: 667 } })
  try {
    const since = await joinAsNewPlayer({ page, eventId: event.id, email, cta: /join to play/i })
    await other.goto(await waitForConfirmPath({ to: email, since }))
    await other.getByRole('button', { name: /tap to finish signing in/i }).click()

    await expectOnEventWithAction({
      page: other,
      eventId: event.id,
      action: /register for this event/i,
    })
  } finally {
    await other.close()
    await cleanUp(
      () => deleteEvent({ id: event.id }),
      () => deletePlayerByEmail({ email }),
    )
  }
})

test('full event: "Join to get on the waitlist" lands on Join the waitlist', async ({ page }) => {
  const event = await createEvent({ maxPlayers: 2 })
  await registerPlayers({
    eventId: event.id,
    playerIds: [SEED_PLAYERS.lena.id, SEED_PLAYERS.noor.id],
  })
  const email = newEmail('full')
  try {
    const since = await joinAsNewPlayer({
      page,
      eventId: event.id,
      email,
      cta: /join to get on the waitlist/i,
    })
    await enterCode({ page, email, since })

    await expectOnEventWithAction({ page, eventId: event.id, action: /join the waitlist/i })
    await page.getByRole('button', { name: /join the waitlist/i }).click()
    const playerId = await playerIdByEmail({ email })
    await expect
      .poll(async () => registrationOf({ eventId: event.id, playerId, columns: 'status' }))
      .toEqual({ status: 'waitlist' })
  } finally {
    await cleanUp(
      () => deleteEvent({ id: event.id }),
      () => deletePlayerByEmail({ email }),
    )
  }
})

test('existing member: "Sign in" on the event page returns to it', async ({ page }) => {
  const event = await createEvent()
  const member = await createPlayer()
  try {
    await page.goto(`/events/${event.id}`)
    await page.getByRole('link', { name: /^sign in$/i }).click()
    await clearInbox({ to: member.email })
    const since = Date.now() - 1000
    await page.getByLabel('Email').fill(member.email)
    await page.getByRole('button', { name: /email me a sign-in code/i }).click()
    await enterCode({ page, email: member.email, since })

    await expectOnEventWithAction({ page, eventId: event.id, action: /register for this event/i })
  } finally {
    await cleanUp(
      () => deleteEvent({ id: event.id }),
      () => deletePlayer({ id: member.id }),
    )
  }
})

test('team event: lands with "Sign up as a team" on screen', async ({ page }) => {
  const event = await createEvent({ entryMode: 'team' })
  const email = newEmail('team')
  try {
    const since = await joinAsNewPlayer({ page, eventId: event.id, email, cta: /join to play/i })
    await enterCode({ page, email, since })

    await expectOnEventWithAction({ page, eventId: event.id, action: /sign up as a team/i })
  } finally {
    await cleanUp(
      () => deleteEvent({ id: event.id }),
      () => deletePlayerByEmail({ email }),
    )
  }
})
