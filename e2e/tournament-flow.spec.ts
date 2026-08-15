import { test, expect, type Page } from '@playwright/test'
import { seedTournament, deleteTournament } from './fixtures/db'
import type { TournamentFixture } from './fixtures/db'

/* ════════════════════════════════════════════════════════════════════════════
   Smoke test — the run-of-show closing sequence, across both roles.

   Covers, in order:
     1. Cold deep link to /events/:id/schedule (direct navigation, signed in
        at that same URL) — this used to redirect to /events on first render.
     2. Admin enters the tournament's last open score.
     3. Admin finishes the tournament from /manage (run-of-show), not Schedule.
     4. A player confirms standings stay withheld (tab absent + route embargo).
     5. Admin opens Oscars voting (hands off to the Oscars tab).
     6. The player casts a vote.
     7. Admin closes voting.
     8. Admin reveals results (folds in the Oscars share when voting closed).
     9. The player sees standings and the Oscars winner.

   State is arranged directly in Postgres (see fixtures/db.ts) rather than
   through the schedule generator UI — matchmaking has its own coverage, and
   driving 16 players through the real generator here would make this test
   slower and flakier without exercising anything new.
   ════════════════════════════════════════════════════════════════════════════ */

let fixture: TournamentFixture

test.beforeAll(async () => {
  fixture = await seedTournament()
})

test.afterAll(async () => {
  if (fixture) await deleteTournament(fixture.tournamentId)
})

// A fresh (unauthenticated) context hitting any protected path — which is
// every path here, see src/lib/authPaths.ts — gets VerificationGate's
// full-screen PIN prompt in place of the route, then renders the route in
// place once signed in. So signing in *at* the deep link, rather than via
// /account first, is both simpler and a more faithful repro of "cold link
// while logged out" than a two-step sign-in-then-navigate would be.
async function signInAt(page: Page, url: string, pin: string) {
  await page.goto(url)
  await page.getByLabel('PIN').fill(pin)
  await page.getByRole('button', { name: /sign in/i }).click()
  // The gate unmounts once `role` flips off 'guest' — confirms the sign-in
  // landed before we do anything else.
  await page.getByLabel('PIN').waitFor({ state: 'hidden' })
  // A fresh sign-in without a role claim kicks off an async syncMyRole()
  // call (see useAuth.ts) that refreshes the session. A hard page.goto()
  // right after the button click can race that — the reload reads
  // localStorage before the refreshed session (and its persistence write)
  // lands, and briefly looks signed-out. Draining the network queue here
  // avoids hand-rolling a poll/retry around every subsequent navigation.
  await page.waitForLoadState('networkidle')
}

test('run-of-show: schedule → finish → oscars → reveal (admin + player)', async ({ browser }) => {
  test.slow()

  const adminCtx = await browser.newContext()
  const playerCtx = await browser.newContext()
  const admin = await adminCtx.newPage()
  const player = await playerCtx.newPage()
  const eventPath = `/events/${fixture.tournamentId}`

  try {
    // ── 1. Cold deep link ──────────────────────────────────────────────────
    // A full navigation straight to the nested Schedule route, not a
    // client-side tab click. The regression this guards against: this used
    // to bounce to /events before the tournament/session resolved.
    await signInAt(admin, `${eventPath}/schedule`, '9999')
    await expect(admin).toHaveURL(new RegExp(`${fixture.tournamentId}/schedule$`))
    await expect(admin.getByRole('button', { name: 'Round 1' })).toBeVisible()

    // ── 2. Admin enters the last score ────────────────────────────────────
    // Round 1 was pre-scored by the fixture; round 2 is the one open match.
    await admin.getByRole('button', { name: 'Round 2' }).click()
    await admin.getByRole('spinbutton', { name: 'Team 1 score' }).fill('6')
    const round2Score2 = admin.getByRole('spinbutton', { name: 'Team 2 score' })
    await round2Score2.fill('2')
    await round2Score2.blur()
    await expect(admin.getByText('✓ Done')).toBeVisible()

    // ── 3. Admin finishes the tournament from /manage, not Schedule ──────
    await admin.goto(`${eventPath}/manage`)
    await expect(admin.getByRole('heading', { name: 'Run of show' })).toBeVisible()
    await admin.getByRole('button', { name: 'Finish tournament' }).click()
    await expect(admin.getByText('Ratings applied, tournament complete')).toBeVisible()

    // ── 4. Player still cannot see standings ──────────────────────────────
    await signInAt(player, eventPath, '1234')
    await expect(player.getByRole('link', { name: 'Results', exact: true })).toHaveCount(0)
    // Defense in depth: the route itself withholds standings even if hit
    // directly, independent of the tab strip.
    await player.goto(`${eventPath}/results`)
    await expect(player.getByText('Results pending')).toBeVisible()
    await expect(player.getByText('Full Standings')).toHaveCount(0)

    // ── 5. Admin opens Oscars voting ──────────────────────────────────────
    await admin.getByRole('button', { name: 'Go to Oscars to open voting' }).click()
    await expect(admin).toHaveURL(new RegExp(`${fixture.tournamentId}/oscars$`))
    await admin.getByRole('button', { name: 'Start Lobster Games' }).click()
    await expect(admin.getByText('Live participation')).toBeVisible()

    // ── 6. The player votes ────────────────────────────────────────────────
    await player.goto(`${eventPath}/oscars`)
    await player.getByRole('button', { name: /Best Lobster/ }).click()
    // Exact match: a player tile's accessible name also folds in its
    // match-history blurb ("R1: vs Baturay & Jon"), which makes every other
    // tile's name a substring of someone's history text too. Only the name
    // label itself renders as an isolated "Baturay" text node.
    await player.getByText('Baturay', { exact: true }).click()
    await expect(player.getByText(/Voted: Baturay/)).toBeVisible()

    // ── 7. Admin closes voting ─────────────────────────────────────────────
    await admin.goto(`${eventPath}/manage`)
    await admin.getByRole('button', { name: 'Close voting' }).click()
    await admin.getByRole('button', { name: 'Confirm' }).click()
    // The step's own button disappears once its state flips to 'done'.
    await expect(admin.getByRole('button', { name: 'Close voting' })).toHaveCount(0)

    // ── 8. Admin reveals the results ───────────────────────────────────────
    // Folds in the Oscars share (a second confirm) because voting is closed.
    await admin.getByRole('button', { name: 'Reveal the results' }).click()
    await admin.getByRole('button', { name: 'Confirm' }).click()
    await expect(admin.getByText('Standings are public')).toBeVisible()

    // ── 9. The player sees standings and the Oscars winner ────────────────
    await player.goto(`${eventPath}/results`)
    await expect(player.getByText('Full Standings')).toBeVisible()
    await player.goto(`${eventPath}/oscars`)
    await expect(player.getByRole('heading', { name: /The Results/ })).toBeVisible()
    await expect(player.getByText('Best Lobster')).toBeVisible()
  } finally {
    await adminCtx.close()
    await playerCtx.close()
  }
})
