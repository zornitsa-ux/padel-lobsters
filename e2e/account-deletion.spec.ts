import type { Browser, Page } from '@playwright/test'
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
import { allowConsoleErrors, expect, test } from './fixtures/test'

/* ════════════════════════════════════════════════════════════════════════════
   Account deletion (docs/account-deletion, AD6). Each test builds its own
   players and events and removes them after, so the seed is untouched; it is
   @seed-write because its events, league and follow-ups would show in the
   views other specs read while they run in parallel.
   ════════════════════════════════════════════════════════════════════════════ */

test.use({ storageState: { cookies: [], origins: [] } })

const ANONYMISED = /^Anonymous [A-Z][a-z]+ #\d+$/
const fullName = (p: CreatedPlayer) => `${p.firstName} Tester`

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

/** Cleanup steps, newest first, so a setup that fails halfway still removes what it made. */
type Undo = (() => Promise<unknown>)[]

/** Players made by the spec, with what deletion leaves behind for them. */
async function makePlayers({ count, undo }: { count: number; undo: Undo }) {
  const players = await Promise.all(Array.from({ length: count }, () => createPlayer()))
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

/**
 * The member has a result in a past event, a paid spot in an upcoming one, a
 * team-event spot as captain with an accepted partner, a league team in an
 * unfinished season, and a photo an admin uploaded under a random name.
 */
async function buildWorld({ undo }: { undo: Undo }): Promise<World> {
  const [member, partner, x, y] = await makePlayers({ count: 4, undo })

  const past = await makeEvent({ undo, name: `E2E past ${Date.now()}`, daysAhead: -7 })
  await registerPlayers({ eventId: past.id, playerIds: [member.id, partner.id, x.id, y.id] })
  await sql`update tournaments set status = 'completed' where id = ${past.id}`
  const { error: matchError } = await admin.from('matches').insert({
    tournament_id: past.id,
    round: 1,
    court: 'Court 1',
    team1_ids: [member.id, x.id],
    team2_ids: [partner.id, y.id],
    score1: 6,
    score2: 4,
    completed: true,
  })
  if (matchError) throw new Error(`could not add the past match: ${matchError.message}`)

  const upcoming = await makeEvent({ undo, name: `E2E upcoming ${Date.now()}` })
  await registerPlayers({ eventId: upcoming.id, playerIds: [member.id] })
  await sql`update registrations set payment_status = 'paid'
             where tournament_id = ${upcoming.id} and player_id = ${member.id}`

  const teamEvent = await makeEvent({ undo, name: `E2E pairs ${Date.now()}`, entryMode: 'team' })
  const [team] = await sql`
    insert into event_teams (tournament_id, captain_id) values (${teamEvent.id}, ${member.id})
    returning id`
  await sql`
    insert into registrations (tournament_id, player_id, team_id, status, payment_status, accepted_at)
    values (${teamEvent.id}, ${member.id}, ${team.id}, 'registered', 'unpaid', now()),
           (${teamEvent.id}, ${partner.id}, ${team.id}, 'registered', 'unpaid', now())`

  const [league] = await sql`
    insert into leagues (name, status, divisions, starts_at, ends_at)
    values (${`E2E league ${Date.now()}`}, 'group_stage', array['mens'],
            current_date - 7, current_date + 30)
    returning id`
  undo.unshift(() => sql`delete from leagues where id = ${league.id}`)
  const [leagueTeam] = await sql`
    insert into league_teams (league_id, division, player1_id, player2_id, team_name, experience_level)
    values (${league.id}, 'mens', ${member.id}, ${partner.id}, 'E2E Pair', 'intermediate')
    returning id`

  const photo = `player-${Date.now()}-e2e.webp`
  await admin.storage
    .from('avatars')
    .upload(photo, new Blob(['x'], { type: 'image/webp' }), { contentType: 'image/webp' })
  undo.unshift(() => admin.storage.from('avatars').remove([photo]))
  const {
    data: { publicUrl },
  } = admin.storage.from('avatars').getPublicUrl(photo)
  await admin.from('players').update({ avatar_url: publicUrl }).eq('id', member.id)

  return {
    member,
    partner,
    pastEventId: past.id,
    upcomingEventId: upcoming.id,
    teamEventId: teamEvent.id,
    teamId: team.id,
    leagueTeamId: leagueTeam.id,
    photo,
  }
}

/** Sends the deletion code to `email` and enters it, ending on the last step. */
async function confirmWithCode({ page, email }: { page: Page; email: string }) {
  await clearInbox({ to: email })
  const since = Date.now() - 1000
  await page.getByRole('button', { name: 'Email me a code' }).click()
  await page.getByLabel('Code').fill(await waitForCode({ to: email, since }))
  await page.getByRole('button', { name: "Confirm it's me" }).click()
  await expect(page.getByText('Last step')).toBeVisible()
}

async function photoGone({ name }: { name: string }) {
  const { data } = await admin.storage.from('avatars').list('', { search: name })
  return (data ?? []).length === 0
}

async function asAdmin<T>({ browser, run }: { browser: Browser; run: (page: Page) => Promise<T> }) {
  const context = await browser.newContext({ storageState: SESSION_FILES.admin })
  try {
    return await run(await context.newPage())
  } finally {
    await context.close()
  }
}

test(
  'a member deletes their account; history stays, the partner keeps the team, the email can join again',
  { tag: '@seed-write' },
  async ({ page, browser }) => {
    const undo: Undo = []
    try {
      const world = await buildWorld({ undo })
      const { member, partner } = world
      undo.unshift(() => deletePlayerByEmail({ email: member.email }))
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

      const [row] =
        await sql`select name, status, email, avatar_url from players where id = ${member.id}`
      expect(row).toMatchObject({ status: 'deleted', email: null, avatar_url: '' })
      expect(row.name).toMatch(ANONYMISED)
      const anonymised = row.name as string
      expect(await photoGone({ name: world.photo })).toBe(true)
      expect((await admin.auth.admin.getUserById(member.id)).data.user).toBeNull()

      const regs = await sql`
        select tournament_id, player_id, status from registrations
         where tournament_id in ${sql([world.pastEventId, world.upcomingEventId, world.teamEventId])}
           and player_id in ${sql([member.id, partner.id])}`
      const statusOf = (eventId: string, playerId: string) =>
        regs.find((r) => r.tournament_id === eventId && r.player_id === playerId)?.status
      expect(statusOf(world.pastEventId, member.id)).toBe('registered')
      expect(statusOf(world.upcomingEventId, member.id)).toBe('cancelled')
      expect(statusOf(world.teamEventId, member.id)).toBe('registered')
      expect(statusOf(world.teamEventId, partner.id)).toBe('registered')
      const [team] = await sql`select captain_id from event_teams where id = ${world.teamId}`
      expect(team.captain_id).toBe(partner.id)
      const [leagueTeam] =
        await sql`select player1_id from league_teams where id = ${world.leagueTeamId}`
      expect(leagueTeam.player1_id).toBe(member.id)
      const [match] =
        await sql`select team1_ids from matches where tournament_id = ${world.pastEventId}`
      expect(match.team1_ids).toContain(member.id)

      await asAdmin({
        browser,
        run: async (adminPage) => {
          await adminPage.goto('/community')
          await expect(adminPage.getByText(partner.firstName).first()).toBeVisible()
          await expect(adminPage.getByText(member.firstName)).toHaveCount(0)
          await expect(adminPage.getByText(anonymised)).toHaveCount(0)

          await adminPage.goto(`/events/${world.pastEventId}/results`)
          await expect(adminPage.getByText(anonymised).first()).toBeVisible()
          await expect(adminPage.getByText(member.firstName)).toHaveCount(0)

          await adminPage.goto('/home')
          await expect(
            adminPage.getByText(`${anonymised} is on a league team. Pick a replacement.`),
          ).toBeVisible()
          await expect(
            adminPage.getByText(
              `${anonymised} is on a team in an upcoming event. A new partner is needed.`,
            ),
          ).toBeVisible()
        },
      })

      const rejoin = await browser.newContext({ storageState: { cookies: [], origins: [] } })
      try {
        const signupPage = await rejoin.newPage()
        await signupPage.goto('/community')
        await signupPage.getByRole('button', { name: /sign up/i }).click()
        await fillSignupForm({ page: signupPage, email: member.email })
        await clearInbox({ to: member.email })
        const since = Date.now() - 1000
        await signupPage.getByRole('button', { name: /join the lobsters/i }).click()
        await signupPage.getByLabel('Code').fill(await waitForCode({ to: member.email, since }))
        await signupPage.getByRole('button', { name: /finish signing up/i }).click()
        await expect
          .poll(async () =>
            (await sql`select id, status from players where email = ${member.email}`).map((r) => ({
              ...r,
            })),
          )
          .toEqual([expect.objectContaining({ status: 'active' })])
        const [rejoined] = await sql`select id from players where email = ${member.email}`
        expect(rejoined.id).not.toBe(member.id)
      } finally {
        await rejoin.close()
      }
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
      const send = page.getByRole('button', { name: 'Email me a code' })
      await expect(send).toBeDisabled()
      await page
        .getByLabel(`Type ${fullName(member)} to confirm`)
        .fill(fullName(member).toLowerCase())
      await confirmWithCode({ page, email: boss.email })

      await page.getByRole('button', { name: 'Delete account' }).click()
      const dialog = page.getByRole('alertdialog')
      await expect(dialog).toContainText(`Player: ${fullName(member)}`)
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
