import { openAs } from './fixtures/auth'
import {
  admin,
  cleanUp,
  createEvent,
  createPlayer,
  deleteEvent,
  deletePlayer,
  PLAYER_PASSWORD,
  registerPlayers,
  registrationOf,
} from './fixtures/db'
import { PLAYER } from './fixtures/seed'
import { SESSION_FILES } from './fixtures/sessions'
import { expect, test } from './fixtures/test'

/* ════════════════════════════════════════════════════════════════════════════
   What a player writes, through the UI, each read back from the database. Every
   test makes its own event or player and removes it afterwards, so the seeded
   world stays as it was. A second player, where a flow needs one, is a
   throwaway account in its own browser (openAs).
   ════════════════════════════════════════════════════════════════════════════ */

test.use({ storageState: SESSION_FILES.player })

async function transfersOf({ eventId }: { eventId: string }) {
  const { data, error } = await admin
    .from('registration_transfers')
    .select('id, status, to_player_id')
    .eq('tournament_id', eventId)
  if (error) throw new Error(`Could not read transfers: ${error.message}`)
  return data
}

test('register for an event, then pay by Tikkie', async ({ page }) => {
  const event = await createEvent()
  try {
    await page.goto(`/events/${event.id}/info`)
    await expect(page.getByText("You haven't signed up yet.")).toBeVisible()
    await page.getByRole('button', { name: 'Register for this event' }).click()
    await expect(page.getByText("You're registered")).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Registered (1/16)' })).toBeVisible()
    const mine = () => registrationOf({ eventId: event.id, playerId: PLAYER.id })
    await expect.poll(mine).toMatchObject({ status: 'registered', payment_status: 'unpaid' })

    await page.getByRole('link', { name: 'You' }).click()
    const tikkieTab = page.context().waitForEvent('page')
    await page.getByRole('link', { name: 'Pay via Tikkie' }).click()
    await (await tikkieTab).close()
    await expect(page.getByText(/Tikkie sent · awaiting admin confirmation/)).toBeVisible()
    await expect.poll(async () => (await mine())?.payment_status).toBe('tikkied')
  } finally {
    await deleteEvent({ id: event.id })
  }
})

test('transfer a spot: the other player accepts and takes it', async ({ page, browser }) => {
  const event = await createEvent()
  const recipient = await createPlayer()
  try {
    await registerPlayers({ eventId: event.id, playerIds: [PLAYER.id] })
    await page.goto(`/events/${event.id}/info`)
    await page.getByRole('button', { name: /transfer spot to another player/i }).click()
    await page.getByRole('textbox', { name: /search player/i }).fill(recipient.firstName)
    await page.getByRole('button', { name: new RegExp(recipient.firstName) }).click()
    await expect(
      page.getByRole('dialog', { name: `Awaiting ${recipient.firstName}'s response` }),
    ).toBeVisible()

    await expect
      .poll(() => transfersOf({ eventId: event.id }))
      .toMatchObject([{ status: 'pending', to_player_id: recipient.id }])
    const [offer] = await transfersOf({ eventId: event.id })

    const other = await openAs({ browser, email: recipient.email, password: PLAYER_PASSWORD })
    try {
      await other.page.goto('/home')
      await expect(other.page.getByText(/wants to transfer their spot to you/)).toBeVisible()
      await other.page.goto(`/transfer/${offer.id}`)
      await other.page.getByRole('button', { name: 'Accept transfer' }).click()
      await expect
        .poll(
          async () => (await registrationOf({ eventId: event.id, playerId: recipient.id }))?.status,
        )
        .toBe('registered')
      const mine = await registrationOf({ eventId: event.id, playerId: PLAYER.id })
      expect(mine?.status).not.toBe('registered')
      expect(other.errors).toEqual([])
    } finally {
      await other.context.close()
    }
  } finally {
    await cleanUp(
      () => deleteEvent({ id: event.id }),
      () => deletePlayer({ id: recipient.id }),
    )
  }
})

test('sign up as a pair: the partner accepts the invite', async ({ page, browser }) => {
  const event = await createEvent({ entryMode: 'team' })
  const partner = await createPlayer()
  try {
    await page.goto(`/events/${event.id}/info`)
    await page.getByRole('button', { name: 'Sign up as a team' }).click()
    await page.getByRole('textbox', { name: 'Search players' }).fill(partner.firstName)
    await page.getByRole('button', { name: new RegExp(partner.firstName) }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    const confirm = page.getByRole('dialog', { name: 'Confirm your team' })
    await expect(confirm.getByText(`You + ${partner.firstName} Tester`)).toBeVisible()
    await confirm.getByRole('button', { name: 'Sign up' }).click()

    const captainRow = () => registrationOf({ eventId: event.id, playerId: PLAYER.id })
    const partnerRow = () => registrationOf({ eventId: event.id, playerId: partner.id })
    await expect.poll(captainRow).toMatchObject({ status: 'registered' })
    await expect.poll(partnerRow).toMatchObject({ status: 'registered', accepted_at: null })
    expect((await partnerRow())?.team_id).toBe((await captainRow())?.team_id)

    const other = await openAs({ browser, email: partner.email, password: PLAYER_PASSWORD })
    try {
      await other.page.goto('/team-invites')
      await expect(other.page.getByText('has entered you as their partner')).toBeVisible()
      await other.page.getByRole('button', { name: 'Accept' }).click()
      await expect.poll(async () => (await partnerRow())?.accepted_at).not.toBeNull()
      await other.page.goto(`/events/${event.id}/me`)
      await expect(other.page.getByText(`You & ${PLAYER.name}`)).toBeVisible()
      expect(other.errors).toEqual([])
    } finally {
      await other.context.close()
    }
  } finally {
    await cleanUp(
      () => deleteEvent({ id: event.id }),
      () => deletePlayer({ id: partner.id }),
    )
  }
})

test('order from the shop', async ({ page }) => {
  try {
    await page.goto('/community/shop')
    // Scoped to the seeded tee: "add a shop item" may add a sized item in parallel.
    const tee = page
      .locator('.card')
      .filter({ has: page.getByText('Lobster Tee', { exact: true }) })
    const order = tee.getByRole('button', { name: 'Order', exact: true })
    await order.click()
    const sizes = tee.getByRole('group', { name: 'Size' })
    await expect(sizes).toHaveAttribute('aria-invalid', 'true')
    await expect(sizes).toHaveAccessibleDescription('Please select a size.')
    await sizes.getByRole('button', { name: 'M', exact: true }).click()
    await expect(tee.getByText('Please select a size.')).toHaveCount(0)
    await order.click()
    await expect(tee.getByText('Ordered!')).toBeVisible()
    await expect
      .poll(async () => {
        const { data } = await admin
          .from('merch_interests')
          .select('merch_item_id, size, status')
          .eq('player_id', PLAYER.id)
        return data
      })
      .toMatchObject([{ merch_item_id: 1, size: 'M', status: 'ordered' }])
  } finally {
    await admin.from('merch_interests').delete().eq('player_id', PLAYER.id).eq('merch_item_id', 1)
  }
})

test('edit the profile', async ({ browser }) => {
  const player = await createPlayer()
  const other = await openAs({ browser, email: player.email, password: PLAYER_PASSWORD })
  try {
    await other.page.goto('/account')
    await other.page.getByRole('button', { name: 'My Lobster Profile' }).click()
    await other.page
      .getByRole('textbox', { name: 'What do you scream before a match?' })
      .fill('Vamos!')
    await other.page.getByRole('button', { name: 'Save Profile' }).click()
    await expect
      .poll(async () => {
        const { data } = await admin.from('players').select('tagline').eq('id', player.id).single()
        return data?.tagline
      })
      .toBe('Vamos!')
    expect(other.errors).toEqual([])
  } finally {
    await cleanUp(
      () => other.context.close(),
      () => deletePlayer({ id: player.id }),
    )
  }
})
