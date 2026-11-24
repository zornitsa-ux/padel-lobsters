import type { Browser, BrowserContext, Page } from '@playwright/test'
import { signIn } from './fixtures/auth'
import {
  admin,
  cleanUp,
  createEvent,
  createPlayer,
  deleteEvent,
  deletePlayer,
  deletePlayerByEmail,
  registerPlayers,
  sql,
  PLAYER_PASSWORD,
  type CreatedPlayer,
  type EventOptions,
} from './fixtures/db'
import { clearInbox, waitForCode } from './fixtures/mailpit'
import { SESSION_FILES } from './fixtures/sessions'
import { fillSignupForm } from './fixtures/signup'
import { allowConsoleErrors, expect, guardPage, test } from './fixtures/test'

/* ════════════════════════════════════════════════════════════════════════════
   Account deletion (docs/account-deletion, AD6). Each test builds its own
   players and events and removes them after, so the seed is untouched; it is
   @seed-write because its events, league and follow-ups would show in the
   views other specs read while they run in parallel.
   ════════════════════════════════════════════════════════════════════════════ */

test.use({ storageState: { cookies: [], origins: [] } })

const ANONYMISED = /^Anonymous [A-Z][a-z]+ #\d+$/
const SIGNED_OUT = { cookies: [], origins: [] }
const fullName = ({ player }: { player: CreatedPlayer }) => `${player.firstName} Tester`

/** Cleanup steps, run in order: setup puts each one first, so a half-built world still goes. */
type Undo = (() => Promise<unknown>)[]

interface World {
  member: CreatedPlayer
  partner: CreatedPlayer
  pastEventId: string
  upcomingEventId: string
  teamEventId: string
  teamId: string
  leagueTeamId: string
  photo: string
}

// ── Setup ──────────────────────────────────────────────────────────────────

/** One at a time: createPlayer's names and emails come from the clock. */
async function makePlayers({ count, undo }: { count: number; undo: Undo }) {
  const players: CreatedPlayer[] = []
  for (let i = 0; i < count; i++) players.push(await createPlayer())
  const ids = players.map((p) => p.id)
  undo.unshift(
    () => sql`delete from security_events where player_id in ${sql(ids)}`,
    () => sql`delete from account_deletion_followups where player_id in ${sql(ids)}`,
    ...ids.map((id) => () => deletePlayer({ id })),
  )
  return players
}

async function makeEvent({ undo, ...options }: EventOptions & { undo: Undo }) {
  const event = await createEvent(options)
  undo.unshift(() => deleteEvent({ id: event.id }))
  return event
}

async function addPastResult({ undo, players }: { undo: Undo; players: CreatedPlayer[] }) {
  const [member, partner, x, y] = players
  const past = await makeEvent({ undo, name: `E2E past ${Date.now()}`, daysAhead: -7 })
  await registerPlayers({ eventId: past.id, playerIds: players.map((p) => p.id) })
  await sql`update tournaments set status = 'completed' where id = ${past.id}`
  const { error } = await admin.from('matches').insert({
    tournament_id: past.id,
    round: 1,
    court: 'Court 1',
    team1_ids: [member.id, x.id],
    team2_ids: [partner.id, y.id],
    score1: 6,
    score2: 4,
    completed: true,
  })
  if (error) throw new Error(`could not add the past match: ${error.message}`)
  return past.id
}

async function addPaidSpot({ undo, member }: { undo: Undo; member: CreatedPlayer }) {
  const event = await makeEvent({ undo, name: `E2E upcoming ${Date.now()}` })
  await registerPlayers({ eventId: event.id, playerIds: [member.id] })
  await sql`update registrations set payment_status = 'paid'
             where tournament_id = ${event.id} and player_id = ${member.id}`
  return event.id
}

/** The member captains; the partner has accepted. Both rows in one statement, as the team trigger wants. */
async function addTeam({
  undo,
  captain,
  partner,
}: {
  undo: Undo
  captain: CreatedPlayer
  partner: CreatedPlayer
}) {
  const event = await makeEvent({ undo, name: `E2E pairs ${Date.now()}`, entryMode: 'team' })
  const [team] = await sql`
    insert into event_teams (tournament_id, captain_id) values (${event.id}, ${captain.id})
    returning id`
  await sql`
    insert into registrations (tournament_id, player_id, team_id, status, payment_status, accepted_at)
    values (${event.id}, ${captain.id}, ${team.id}, 'registered', 'unpaid', now()),
           (${event.id}, ${partner.id}, ${team.id}, 'registered', 'unpaid', now())`
  return { teamEventId: event.id, teamId: team.id as string }
}

async function addLeagueTeam({ undo, players }: { undo: Undo; players: CreatedPlayer[] }) {
  const [league] = await sql`
    insert into leagues (name, status, divisions, starts_at, ends_at)
    values (${`E2E league ${Date.now()}`}, 'group_stage', array['mens'],
            current_date - 7, current_date + 30)
    returning id`
  undo.unshift(() => sql`delete from leagues where id = ${league.id}`)
  const [team] = await sql`
    insert into league_teams (league_id, division, player1_id, player2_id, team_name, experience_level)
    values (${league.id}, 'mens', ${players[0].id}, ${players[1].id}, 'E2E Pair', 'intermediate')
    returning id`
  return team.id as string
}

/** A photo an admin uploaded under a random name, which is what production holds. */
async function addPhoto({ undo, member }: { undo: Undo; member: CreatedPlayer }) {
  const photo = `player-${Date.now()}-e2e.webp`
  const bucket = admin.storage.from('avatars')
  const { error: uploadError } = await bucket.upload(
    photo,
    new Blob(['x'], { type: 'image/webp' }),
    {
      contentType: 'image/webp',
    },
  )
  if (uploadError) throw new Error(`could not upload the photo: ${uploadError.message}`)
  undo.unshift(() => bucket.remove([photo]))
  const { error } = await admin
    .from('players')
    .update({ avatar_url: bucket.getPublicUrl(photo).data.publicUrl })
    .eq('id', member.id)
  if (error) throw new Error(`could not set the photo: ${error.message}`)
  return photo
}

/**
 * The member has a result in a past event, a paid spot in an upcoming one, a
 * team-event spot as captain with an accepted partner, a league team in an
 * unfinished season, and a photo an admin uploaded.
 */
async function buildWorld({ undo }: { undo: Undo }): Promise<World> {
  const players = await makePlayers({ count: 4, undo })
  const [member, partner] = players
  return {
    member,
    partner,
    pastEventId: await addPastResult({ undo, players }),
    upcomingEventId: await addPaidSpot({ undo, member }),
    ...(await addTeam({ undo, captain: member, partner })),
    leagueTeamId: await addLeagueTeam({ undo, players }),
    photo: await addPhoto({ undo, member }),
  }
}

// ── Steps ──────────────────────────────────────────────────────────────────

/** Asks for a code with `send`, enters it from Mailpit and submits it with `submit`. */
async function enterEmailCode({
  page,
  email,
  send,
  submit,
}: {
  page: Page
  email: string
  send: string | RegExp
  submit: string | RegExp
}) {
  await clearInbox({ to: email })
  const since = Date.now() - 1000
  await page.getByRole('button', { name: send }).click()
  await page.getByLabel('Code').fill(await waitForCode({ to: email, since }))
  await page.getByRole('button', { name: submit }).click()
}

async function confirmWithCode({ page, email }: { page: Page; email: string }) {
  await enterEmailCode({ page, email, send: 'Email me a code', submit: "Confirm it's me" })
  await expect(page.getByText('Last step')).toBeVisible()
}

/** A guarded page in a context of its own; `done` closes it and fails on any page error. */
async function openGuarded({
  browser,
  storageState,
}: {
  browser: Browser
  storageState: string | typeof SIGNED_OUT
}): Promise<{ page: Page; done: () => Promise<void> }> {
  const context: BrowserContext = await browser.newContext({ storageState })
  const page = await context.newPage()
  const errors = await guardPage({ page })
  return {
    page,
    done: async () => {
      await context.close()
      expect(errors).toEqual([])
    },
  }
}

async function photoExists({ name }: { name: string }) {
  const { data, error } = await admin.storage.from('avatars').list('', { search: name })
  if (error) throw new Error(`could not list photos: ${error.message}`)
  return data.length > 0
}

// ── Checks ─────────────────────────────────────────────────────────────────

async function expectHistoryKept({ world }: { world: World }) {
  const { member, partner } = world
  const regs = await sql`
    select tournament_id, player_id, status from registrations
     where tournament_id in ${sql([world.pastEventId, world.upcomingEventId, world.teamEventId])}
       and player_id in ${sql([member.id, partner.id])}`
  const statusOf = ({ eventId, playerId }: { eventId: string; playerId: string }) =>
    regs.find((r) => r.tournament_id === eventId && r.player_id === playerId)?.status
  expect(statusOf({ eventId: world.pastEventId, playerId: member.id })).toBe('registered')
  expect(statusOf({ eventId: world.upcomingEventId, playerId: member.id })).toBe('cancelled')
  expect(statusOf({ eventId: world.teamEventId, playerId: member.id })).toBe('registered')
  expect(statusOf({ eventId: world.teamEventId, playerId: partner.id })).toBe('registered')

  const [team] = await sql`select captain_id from event_teams where id = ${world.teamId}`
  expect(team.captain_id).toBe(partner.id)
  const [leagueTeam] =
    await sql`select player1_id from league_teams where id = ${world.leagueTeamId}`
  expect(leagueTeam.player1_id).toBe(member.id)
  const [match] =
    await sql`select team1_ids from matches where tournament_id = ${world.pastEventId}`
  expect(match.team1_ids).toContain(member.id)
}

/** Returns the anonymised name. */
async function expectAccountGone({ world }: { world: World }): Promise<string> {
  const [row] = await sql`
    select name, status, email, avatar_url from players where id = ${world.member.id}`
  expect(row).toMatchObject({ status: 'deleted', email: null, avatar_url: '' })
  expect(row.name).toMatch(ANONYMISED)
  expect(await photoExists({ name: world.photo })).toBe(false)
  expect((await admin.auth.admin.getUserById(world.member.id)).data.user).toBeNull()
  return row.name as string
}

async function expectAdminViews({
  browser,
  world,
  anonymised,
}: {
  browser: Browser
  world: World
  anonymised: string
}) {
  const { page, done } = await openGuarded({ browser, storageState: SESSION_FILES.admin })
  await page.goto('/community')
  await expect(page.getByText(world.partner.firstName).first()).toBeVisible()
  await expect(page.getByText(world.member.firstName)).toHaveCount(0)
  await expect(page.getByText(anonymised)).toHaveCount(0)

  await page.goto(`/events/${world.pastEventId}/results`)
  await expect(page.getByText(anonymised).first()).toBeVisible()
  await expect(page.getByText(world.member.firstName)).toHaveCount(0)

  await page.goto('/home')
  await expect(
    page.getByText(`${anonymised} is on a league team. Pick a replacement.`),
  ).toBeVisible()
  await expect(
    page.getByText(`${anonymised} is on a team in an upcoming event. A new partner is needed.`),
  ).toBeVisible()
  await done()
}

async function expectRejoinAsNewMember({
  browser,
  member,
}: {
  browser: Browser
  member: CreatedPlayer
}) {
  const { page, done } = await openGuarded({ browser, storageState: SIGNED_OUT })
  await page.goto('/community')
  await page.getByRole('button', { name: /sign up/i }).click()
  await fillSignupForm({ page, email: member.email })
  await enterEmailCode({
    page,
    email: member.email,
    send: /join the lobsters/i,
    submit: /finish signing up/i,
  })
  await expect
    .poll(async () => (await sql`select status from players where email = ${member.email}`).length)
    .toBe(1)
  const [rejoined] = await sql`select id, status from players where email = ${member.email}`
  expect(rejoined.status).toBe('active')
  expect(rejoined.id).not.toBe(member.id)
  await done()
}

// ── Tests ──────────────────────────────────────────────────────────────────

test(
  'a member deletes their account; history stays, the partner keeps the team, the email can join again',
  { tag: '@seed-write' },
  async ({ page, browser }) => {
    const undo: Undo = []
    try {
      const world = await buildWorld({ undo })
      const { member } = world
      // Last: by then the league and events that reference the member are gone.
      undo.push(() => deletePlayerByEmail({ email: member.email }))
      expect(await photoExists({ name: world.photo })).toBe(true)

      // The auth user is gone by the time the client signs out, so GoTrue answers 403.
      allowConsoleErrors({ page, patterns: [/status of 403 .*\/auth\/v1\/logout/] })
      await signIn({ page, email: member.email, password: PLAYER_PASSWORD, at: '/account' })
      await page.goto('/account')
      await page.getByRole('button', { name: 'Delete my account' }).click()
      await expect(page.getByText(/^Your spot in E2E upcoming/)).toBeVisible()
      await expect(page.getByText(/^You've paid for E2E upcoming/)).toBeVisible()
      await expect(page.getByText(/^E2E pairs .*: if your partner has accepted/)).toBeVisible()
      await confirmWithCode({ page, email: member.email })
      await page.getByRole('button', { name: 'Delete account' }).click()

      await expect(page).toHaveURL(/\/goodbye$/)
      await expect(page.getByRole('heading', { name: 'Your account is deleted' })).toBeVisible()
      await expect(page.getByRole('navigation')).toHaveCount(0)

      const anonymised = await expectAccountGone({ world })
      await expectHistoryKept({ world })
      await expectAdminViews({ browser, world, anonymised })
      await expectRejoinAsNewMember({ browser, member })
    } finally {
      await cleanUp(...undo)
    }
  },
)

test(
  "an admin deletes a member's account after naming them twice",
  { tag: '@seed-write' },
  async ({ page }) => {
    const undo: Undo = []
    try {
      const [boss, member] = await makePlayers({ count: 2, undo })
      const event = await makeEvent({ undo, name: `E2E upcoming ${Date.now()}` })
      await sql`update players set role = 'admin' where id = ${boss.id}`
      await registerPlayers({ eventId: event.id, playerIds: [member.id] })

      await signIn({ page, email: boss.email, password: PLAYER_PASSWORD, at: '/account' })
      await page.goto(`/community/${member.id}`)
      await page.getByRole('button', { name: 'Delete account' }).click()
      await expect(page.getByText(/^Their spot in E2E upcoming/)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Email me a code' })).toBeDisabled()
      const name = fullName({ player: member })
      await page.getByLabel(`Type ${name} to confirm`).fill(name.toLowerCase())
      await confirmWithCode({ page, email: boss.email })

      await page.getByRole('button', { name: 'Delete account' }).click()
      const dialog = page.getByRole('alertdialog')
      await expect(dialog).toContainText(`Player: ${name}`)
      await dialog.getByRole('button', { name: 'Delete account' }).click()

      await expect(page.getByText(/account is deleted\. They now show as Anonymous/)).toBeVisible()
      await expect(page.getByText('This account was deleted.')).toBeVisible()
      const [row] = await sql`select status, email from players where id = ${member.id}`
      expect(row).toEqual({ status: 'deleted', email: null })
      const events =
        await sql`select attempt_kind from security_events where player_id = ${member.id}`
      expect(events.map((e) => e.attempt_kind)).toEqual(['account_deleted_admin'])
      const [reg] = await sql`
        select status from registrations where tournament_id = ${event.id} and player_id = ${member.id}`
      expect(reg.status).toBe('cancelled')
    } finally {
      await cleanUp(...undo)
    }
  },
)
