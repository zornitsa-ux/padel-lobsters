import type { Page } from '@playwright/test'
import {
  admin,
  cleanUp,
  createEvent,
  deleteEvent,
  registerPlayers,
  registrationOf,
  sql,
} from './fixtures/db'
import { fieldAfterLabel, rowWith } from './fixtures/locators'
import { ADMIN, SEED_LEAGUE, SEED_PLAYERS } from './fixtures/seed'
import { SESSION_FILES } from './fixtures/sessions'
import { expect, test } from './fixtures/test'

/* ════════════════════════════════════════════════════════════════════════════
   What an admin writes, through the UI, each read back from the database.
   Event flows run on a throwaway event. Where a flow has to change a seeded
   row (the league match, the Lobster Way), it restores the row afterwards and
   is tagged @seed-write, so it runs after the specs that read the seed.
   Acting for another player goes through the on-behalf confirm, which must
   name who was picked.
   ════════════════════════════════════════════════════════════════════════════ */

test.use({ storageState: SESSION_FILES.admin })

const { lena, noor, kofi } = SEED_PLAYERS

/** The open confirm dialog; checks it names every line before returning it. */
async function confirmDialog({
  page,
  title,
  lines,
}: {
  page: Page
  title: string
  lines: string[]
}) {
  const dialog = page.getByRole('alertdialog', { name: title })
  await expect(dialog).toBeVisible()
  for (const line of lines) await expect(dialog).toContainText(line)
  return dialog
}

test('create an event through the form', async ({ page }) => {
  const name = `E2E form event ${Date.now()}`
  try {
    await page.goto('/events')
    await page.getByRole('button', { name: 'New', exact: true }).click()
    const form = page.getByRole('dialog', { name: 'New Event' })
    await form.getByPlaceholder('e.g. Lobsters Americano #12').fill(name)
    await form.getByPlaceholder('e.g. Padel City Amsterdam').fill('E2E Court')
    await fieldAfterLabel({ scope: form, label: 'Date *' }).fill('2030-06-01')
    await form.getByRole('button', { name: 'King of the Court' }).click()
    await form.getByRole('button', { name: 'Create Event' }).click()
    await expect(form).toBeHidden()
    await expect(page.getByRole('heading', { name })).toBeVisible()

    await expect
      .poll(async () => {
        const { data } = await admin
          .from('tournaments')
          .select('location, date, format, status')
          .eq('name', name)
        return data
      })
      .toMatchObject([
        {
          location: 'E2E Court',
          date: '2030-06-01',
          format: 'king_of_court',
          status: 'upcoming',
        },
      ])
  } finally {
    const rows = await sql`select id from tournaments where name = ${name}`
    await cleanUp(
      ...rows.map(
        ({ id }) =>
          () =>
            deleteEvent({ id }),
      ),
    )
  }
})

test('add a player for someone else: the confirm and the payment sheet name them', async ({
  page,
}) => {
  const event = await createEvent()
  try {
    await page.goto(`/events/${event.id}/info`)
    await page.getByRole('button', { name: 'Register a Player' }).click()
    await page.getByRole('textbox', { name: 'Search players' }).fill(lena.name)
    await page.getByRole('button', { name: lena.name }).click()
    await page.getByRole('button', { name: 'Register Player' }).click()

    const dialog = await confirmDialog({
      page,
      title: 'Add this player?',
      lines: [`Player: ${lena.name}`, `Event: ${event.name}`],
    })
    await dialog.getByRole('button', { name: 'Add player' }).click()

    const lenaReg = () => registrationOf({ eventId: event.id, playerId: lena.id })
    await expect.poll(lenaReg).toMatchObject({ status: 'registered', payment_status: 'unpaid' })

    const sheet = page.getByRole('dialog', {
      name: `${lena.name} is in. Now pay to lock their spot`,
    })
    await expect(sheet.getByText('Their share')).toBeVisible()
    await expect(sheet.getByText('Add to calendar')).toHaveCount(0)

    // Opening the link as the admin says nothing about whether Lena paid.
    const paymentWrites: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('set_registration_payment')) paymentWrites.push(request.url())
    })
    const tikkie = sheet.getByRole('link', { name: `Pay via Tikkie for ${lena.name}` })
    const tikkieTab = page.context().waitForEvent('page')
    await tikkie.click()
    await (await tikkieTab).close()
    await expect(tikkie).toBeEnabled()
    await sheet.getByRole('button', { name: `Mark ${lena.name} as paid` }).click()
    const update = await confirmDialog({
      page,
      title: 'Update payment?',
      lines: [`Player: ${lena.name}`, 'Change: Mark as paid (tikkie)'],
    })
    expect(paymentWrites).toEqual([])
    await update.getByRole('button', { name: 'Update payment' }).click()

    await expect.poll(lenaReg).toMatchObject({ payment_status: 'paid', payment_method: 'tikkie' })
    await expect(sheet).toBeHidden()
    await expect(page.getByRole('heading', { name: 'Registered (1/16)' })).toBeVisible()
  } finally {
    await deleteEvent({ id: event.id })
  }
})

test('add a team for someone else: the confirm names captain and partner', async ({ page }) => {
  const event = await createEvent({ entryMode: 'team' })
  try {
    await page.goto(`/events/${event.id}/info`)
    await page.getByRole('button', { name: 'Add team' }).click()
    await page.getByRole('textbox', { name: 'Search players' }).fill(lena.name)
    await page.getByRole('button', { name: lena.name }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByText(`Partner for ${lena.name}`)).toBeVisible()
    await page.getByRole('textbox', { name: 'Search players' }).fill(noor.name)
    await page.getByRole('button', { name: noor.name }).click()
    await page.getByRole('button', { name: 'Add team' }).click()

    const dialog = await confirmDialog({
      page,
      title: 'Add this team?',
      lines: [`Captain: ${lena.name}`, `Partner: ${noor.name}`],
    })
    await dialog.getByRole('button', { name: 'Add team' }).click()

    const captain = () => registrationOf({ eventId: event.id, playerId: lena.id })
    const partner = () => registrationOf({ eventId: event.id, playerId: noor.id })
    await expect.poll(captain).toMatchObject({ status: 'registered' })
    await expect.poll(partner).toMatchObject({ status: 'registered' })
    await expect(
      page.getByRole('dialog', {
        name: `Team ${lena.name} & ${noor.name} is in. Now pay to lock their spot`,
      }),
    ).toBeVisible()
    const teamId = (await captain())?.team_id
    expect(teamId).toBeTruthy()
    expect((await partner())?.team_id).toBe(teamId)
  } finally {
    await deleteEvent({ id: event.id })
  }
})

test('Mark Paid through the menu: the confirm names the player', async ({ page }) => {
  const event = await createEvent()
  try {
    await registerPlayers({ eventId: event.id, playerIds: [noor.id, kofi.id] })
    await page.goto(`/events/${event.id}/manage`)
    await page.getByRole('button', { name: 'Payments', exact: true }).click()
    await rowWith({ scope: page, texts: [kofi.name], button: 'Mark Paid' })
      .getByRole('button', { name: 'Mark Paid' })
      .click()
    await page.getByRole('menuitem', { name: 'Tikkie' }).click()

    const dialog = await confirmDialog({
      page,
      title: 'Update payment?',
      lines: [`Player: ${kofi.name}`, 'Change: Mark as paid (tikkie)'],
    })
    await dialog.getByRole('button', { name: 'Update payment' }).click()

    await expect
      .poll(() => registrationOf({ eventId: event.id, playerId: kofi.id }))
      .toMatchObject({ payment_status: 'paid', payment_method: 'tikkie' })
    expect(await registrationOf({ eventId: event.id, playerId: noor.id })).toMatchObject({
      payment_status: 'unpaid',
    })
  } finally {
    await deleteEvent({ id: event.id })
  }
})

test('cancel a registration', async ({ page }) => {
  const event = await createEvent()
  try {
    await registerPlayers({ eventId: event.id, playerIds: [noor.id, kofi.id] })
    await page.goto(`/events/${event.id}/info`)
    await rowWith({ scope: page, texts: [kofi.name], button: 'Cancel registration' })
      .getByRole('button', { name: 'Cancel registration' })
      .click()
    const dialog = await confirmDialog({
      page,
      title: `Cancel ${kofi.name}'s registration?`,
      lines: [],
    })
    await dialog.getByRole('button', { name: 'Confirm' }).click()

    await expect
      .poll(async () => (await registrationOf({ eventId: event.id, playerId: kofi.id }))?.status)
      .toBe('cancelled')
    expect(await registrationOf({ eventId: event.id, playerId: noor.id })).toMatchObject({
      status: 'registered',
    })
    await expect(page.getByRole('heading', { name: 'Registered (1/16)' })).toBeVisible()
  } finally {
    await deleteEvent({ id: event.id })
  }
})

test('generate a schedule, save it and enter a score', async ({ page }) => {
  const event = await createEvent({ status: 'active', daysAhead: 0 })
  try {
    await registerPlayers({ eventId: event.id, playerIds: [ADMIN.id, lena.id, noor.id, kofi.id] })
    await page.goto(`/events/${event.id}/schedule`)
    await page.getByRole('button', { name: 'Generate schedule' }).click()
    await expect(page.getByText('Schedule generated. Review it below.')).toBeVisible()
    await page.getByRole('button', { name: 'Save', exact: true }).click()

    const matches = async () => {
      const { data } = await admin
        .from('matches')
        .select('round, score1, score2, completed')
        .eq('tournament_id', event.id)
        .order('round')
      return data ?? []
    }
    await expect.poll(async () => (await matches()).length).toBeGreaterThan(0)

    await page.getByRole('button', { name: 'Round 1' }).click()
    await page.getByRole('spinbutton', { name: 'Team 1 score' }).first().fill('6')
    const score2 = page.getByRole('spinbutton', { name: 'Team 2 score' }).first()
    await score2.fill('3')
    await page.keyboard.press('Tab')
    await expect
      .poll(async () => (await matches())[0])
      .toMatchObject({
        round: 1,
        score1: 6,
        score2: 3,
        completed: true,
      })
  } finally {
    await deleteEvent({ id: event.id })
  }
})

test('league Manage: enter the pending score', { tag: '@seed-write' }, async ({ page }) => {
  const { team1, team2 } = SEED_LEAGUE.pendingMatch
  // The service role has no grant on league_matches, so this goes through sql.
  const readMatch = async () => {
    const rows = await sql`
      select id, set_scores, winner_id, played_on::text, location from league_matches
       where league_id = ${SEED_LEAGUE.id} and stage = 'group'
         and team1_id = ${team1.id} and team2_id = ${team2.id}`
    if (rows.length !== 1) throw new Error(`Expected the one seeded match, found ${rows.length}`)
    return rows[0]
  }
  const saved = await readMatch()
  try {
    await page.goto(`/league/${SEED_LEAGUE.id}/manage`)
    await page.getByRole('button', { name: 'Matches' }).click()
    await rowWith({ scope: page, texts: [team1.name, team2.name], button: 'Enter Score' })
      .getByRole('button', { name: 'Enter Score' })
      .click()
    const form = page.getByRole('dialog', { name: 'Enter Score' })
    const games = form.getByRole('spinbutton')
    for (const [i, value] of ['6', '4', '6', '2'].entries()) await games.nth(i).fill(value)
    await form.getByRole('button', { name: 'Save Result' }).click()
    await expect(form).toBeHidden()
    await expect(page.getByText('Results (4)')).toBeVisible()

    await expect.poll(readMatch).toMatchObject({
      set_scores: [
        { t1: 6, t2: 4 },
        { t1: 6, t2: 2 },
      ],
      winner_id: team1.id,
    })
  } finally {
    await sql`
      update league_matches
         set set_scores = ${saved.set_scores === null ? null : sql.json(saved.set_scores)},
             winner_id = ${saved.winner_id}, played_on = ${saved.played_on},
             location = ${saved.location}
       where id = ${saved.id}`
  }
})

test('add a shop item', async ({ page }) => {
  const name = `E2E Socks ${Date.now()}`
  try {
    await page.goto('/community/shop')
    await page.getByRole('button', { name: '⚙️ Manage' }).click()
    await page.getByRole('button', { name: 'Add Merch Item' }).click()
    const form = page.getByRole('dialog', { name: 'Add Merch Item' })
    await form.getByPlaceholder('e.g. Technical T-Shirt').fill(name)
    await form.getByPlaceholder('0.00').fill('12')
    await form.getByRole('button', { name: 'M', exact: true }).click()
    await form.getByRole('button', { name: 'Add Item' }).click()
    await expect(form).toBeHidden()
    await expect(page.getByRole('button', { name: `Edit ${name}` })).toBeVisible()

    await expect
      .poll(async () => {
        const { data } = await admin
          .from('merch_items')
          .select('price, sizes, active')
          .eq('name', name)
        return data
      })
      .toMatchObject([{ price: 12, sizes: ['M'], active: true }])
  } finally {
    await admin.from('merch_items').delete().eq('name', name)
  }
})

test('Lobster Way admin saves an edit', { tag: '@seed-write' }, async ({ page }) => {
  const readContent = async () => {
    const { data } = await admin
      .from('settings')
      .select('lobster_way_content')
      .eq('id', 1)
      .single()
      .throwOnError()
    return data
  }
  const saved = await readContent()
  const story = `E2E story ${Date.now()}`
  try {
    await page.goto('/admin/lobster-way')
    await page.getByRole('button', { name: '🦞 Origin story' }).click()
    await fieldAfterLabel({ scope: page, label: 'Story text' }).fill(story)
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect
      .poll(async () => (await readContent()).lobster_way_content[0])
      .toMatchObject({ label: 'Origin story', story })
  } finally {
    await admin.from('settings').update(saved).eq('id', 1).throwOnError()
  }
})
