# Implementation brief — Tournament IA redesign (single coordinated launch)

## What this is

You are implementing a full redesign of the tournament experience in the Padel Lobsters app
(`/Users/jgrim/padel-lobsters`). A UX/IA review has already been completed and root-caused five
defects; you are not being asked to re-investigate them. Read the review first:

**https://claude.ai/code/artifact/113b9bb0-1517-4273-b281-030c875caf05**

This ships as **one coordinated release**, not a phased rollout. Nothing goes to production until the
whole redesign is done, tested, and reviewed. That means you can freely delete and restructure rather
than maintaining parallel old/new paths — but it also means the branch will be long-lived, so keep it
rebased on `main` and keep CI green at every commit.

Also read before writing code:

- `CLAUDE.md` — commands, code style (comments reserved for complex/critical code; short
  single-purpose functions; named arguments via destructured objects; refactor duplication as you go).
- `ARCHITECTURE.md` — stack, data model, frontend structure.
- `docs/matchmaking-v2/DECISIONS.md` — **required.** Several design calls here are easy to undo by
  accident. D-029 in particular constrains this work (see Constraints below).
- `docs/matchmaking-v2/PLAN.md` — Phase 4 is still open; §1 must be updated at the end of every
  working session.

## Goal

The tournament pages currently serve three different jobs — a player's event, an admin's console,
and a social-hour show — through one role-split tab strip that has no notion of what phase the
tournament is in. Every defect below is that same gap in a different costume. The redesign
introduces a shared phase model and rebuilds the surfaces on top of it.

Two audiences, both of which matter:

- **Players** register, manage their entry (pay, transfer, cancel), find out where and with whom they
  are playing, follow how they are doing, and take part in social hour (Oscars voting, seeing the
  raffle and the winners).
- **Admins also play.** They do everything a player does, plus manage event info and roster, collect
  scores across 4–8 courts during the event, and run the whole post-tournament sequence.

## Non-negotiable constraints

1. **D-029 independence must survive.** The results reveal is deliberately independent of rating
   review — an admin can reveal before, after, or interleaved with resolving flagged ratings.
   Presenting the run-of-show as an ordered list must NOT introduce a hard dependency between them.
   Gate a step only where the data genuinely requires it (you cannot close voting you never opened).
2. **Tournament status and Oscars session lifecycle stay decoupled.** Coupling them through the UI is
   the cause of defect 4. `lobster_oscars_cast_vote` does not look at `tournaments.status` and must
   not start to.
3. **Old share links must keep working.** WhatsApp messages and calendar invites in the wild point at
   `/events/:id`, `/events/:id/schedule`, `/?event=<id>` and `/transfer/<id>`. Routes you retire
   become redirects; `DeepLinkMigrator` keeps working.
4. **No backend changes are needed and none should be made.** Every fix and every new surface in this
   redesign is frontend-only. `raffle_winners` already carries a `select_all` policy
   (`using (true)`, `init.sql:1978`), so surfacing winners to players needs no migration or RLS
   change. If you believe you have found a case that genuinely requires a migration, stop and ask.
5. **Keep the flat-reads data pattern.** Mount load + `useRefreshOnFocus` + reload-after-own-write;
   schedule liveness via `postgres_changes`; live score sync via Broadcast. Do not add polling and do
   not add Realtime subscriptions — disk-IO on the Micro instance was nearly drained by Realtime
   fan-out once already. `useEventDataLoader` deliberately does not do its own focus invalidation;
   don't add it back.
6. **Work on a feature branch, never commit to `main`.** Do not push or open a PR unless asked. Note
   that new git worktrees branch from `main`, not from your current feature branch — if you use one,
   diff before copying anything across.

## Workstreams

### A. The phase model (do this first — everything else depends on it)

Create a pure module, `src/features/events/eventPhase.ts`, modelled closely on the two that already
exist and work well: `src/features/events/resultsPhase.ts` and
`src/features/oscars/oscarsPhase.ts`. No React, no Supabase, side-effect free, unit-testable in the
default `node` test environment.

It derives one phase from the state that already exists: `tournaments.status`, `date`, whether
matches are saved, whether all matches are scored, `completedAt`, `results_shared_at`, the Oscars
session's `started_at`/`closed_at`/`shared_at`, and whether `raffle_winners` rows exist.

Phases: `open` → `set` → `live` → `sealed` → `social` → `revealed`. The review's §02 table defines
what each means and what each audience needs in it. Every tab, button and guard in the redesign
reads this — no surface should re-derive phase from a single flag again.

### B. Routing and guards

- **Fix the deep-link bug.** `useTournamentFromUrl()` (`App.tsx:169`) cannot distinguish "loading"
  from "not found": `useTournaments()` returns `data = []` while in flight, and all eight event
  routes then run `if (!tournament) return <Navigate to="/events" replace />`. Return the query's
  pending state, render the existing `<RouteFallback />` while pending, and only redirect once the
  query has settled and the id genuinely is not in the list. One hook change fixes all eight routes.
  Note the current `replace` also destroys the URL so Back cannot recover it.
- **Phase-gate the tab strip** in `EventShell.tsx`. Today it splits purely on `isAdmin`, so six tabs
  exist from the moment an event is created — including Results before any score exists. Tabs should
  appear when they are relevant to the current phase.
- **Make Oscars player-visible**, driven by Oscars session phase rather than tournament status. It is
  currently in `ADMIN_TAB_PATHS` (`EventShell.tsx:12`), and a player's only door is the
  `{!isCompleted && …}` Lobster Games button (`Registration.tsx:543`) — which Finish closes.
- **Add `/events/:id/me`** — the player's own tournament. Answers, in order and phase-appropriately:
  Am I in? Have I paid? Where am I playing next, with whom, against whom? How am I doing? This
  becomes the default tab during `live`. Today this information is scattered across Info and the
  Schedule grid, and the filtered "Your Matches" block vanishes on completion because
  `isPlayerView = !isAdmin && !isCompleted`.
- **Add `/events/:id/manage`** — the admin console. `/payments`, `/raffle` and `/eligibility` become
  sections inside it and their old routes become redirects.

### C. The run-of-show

One ordered panel inside `/manage`, visible from `sealed` onward, replacing controls currently
scattered across four screens. The review's §04 specifies all eight steps, their gates, and what
players can see at each. Each step shows its own state, unlocks only when its precondition is met,
and states what players can currently see.

Two things this must absorb:

- **Delete the Info-tab completion button** (`ScoresAndRankingSection.tsx:213`). It writes `status`
  and `completedAt` without calling `applyTournamentRatings`, and because Schedule's correct Finish
  button is gated on `!isTournamentCompleted`, using it makes the correct path disappear — so the
  learned ratings for that event can never be applied, silently. There must be exactly one
  completion control in the app.
- **Rename the surviving one.** "Finish Tournament & See Results" (`Schedule.tsx:837`) does not
  navigate on the V2 path (deliberate `return` at `Schedule.tsx:358`). The label lies.

Also fold in: reveal rankings and Oscars winners as one action, add live turnout beside Close Voting
("22 of 24 players voted"), and split Draw raffle from Publish winners so the room hears it from the
admin first.

### D. Content restructure

- **Remove `ScoresAndRankingSection` from the Info tab.** Its podium and standings render on
  `(allScored || isCompleted)`, so results leak the instant the last score is typed — before Finish
  is even pressed. The Results tab (`Scores.tsx:92`) already gates correctly via `resultsWithheld()`.
  Delete the duplicate rather than adding a guard to it.
- **Re-stack Info** to be about the event and only the event. Review §05 has the before/after
  inventory. Registration and payment move to `/me`.
- **One visual treatment.** Event meta currently sits bare on the cream ground, the description in a
  grey inset, everything else in `.card`, stats in solid teal, plus two full-width gradient buttons.
  Put the meta in a card like everything else. Reduce the four-up stat bar (Registered / Waitlist /
  Max / Spots left) to the two numbers that matter.
- **Trim `EventAdminMenu`** to Edit event and Delete event. It currently duplicates Payments, Scores,
  Raffle and Eligibility, all of which are tabs two centimetres above it.
- **Surface raffle winners to players** on Results, published as run-of-show step 08.

### E. Score entry during the event

Score entry stays **admin-only** — that decision is made, do not redistribute it to players. But it
is the single highest-pressure interaction in the product (one or two admins, 4–8 courts, a loud
venue, 90 minutes) and it deserves attention as part of this redesign: fewest taps to enter a score,
obvious progress ("14 of 16"), and an obvious next unscored match.

Preserve the existing concurrency behaviour in `ScoreEntry.tsx` — the dirty-draft/conflict-parking
logic exists because several admins enter scores simultaneously, and its comments explain
subtleties (e.g. why `dirtyRef` clears before the changed-check) that are easy to break. It has
tests; keep them passing.

## Testing bar

### Unit tests — required, not optional

Repo conventions, follow them:

- Vitest, `environment: 'node'` by default (`vite.config.js`), `include: src/**/*.test.{js,jsx,ts,tsx}`.
- Component and hook tests opt into jsdom with a `// @vitest-environment jsdom` docblock on line 1.
  38 of the 127 existing test files do this — copy the pattern from
  `src/features/events/ScoreEntry.test.tsx`.
- `@testing-library/react` is available. `afterEach(cleanup)`.
- Run one file with `npx vitest run <path>`.

What must be covered:

1. **`eventPhase.ts` — exhaustively.** It is pure and it is the spine of the redesign. Table-driven
   tests over every state combination, including the transitions that caused the original defects:
   all-scored-but-not-completed must not be `revealed`; completed-but-not-shared must be `social`, not
   `revealed`; Oscars phase must move independently of tournament status.
2. **Regression tests for all five defects**, each written so it fails against the current code:
   - Deep link to a sub-route with the tournaments query still pending renders the fallback and does
     **not** redirect to `/events`; once settled with a missing id, it does.
   - Info tab renders no podium/standings/ranking table at any phase.
   - A non-admin registered player can reach Oscars voting when tournament status is `completed` and
     the Oscars session is `active`.
   - Exactly one completion control exists, and it applies ratings before marking complete.
   - `resultsWithheld` is honoured by every surface that renders standings.
3. **Tab visibility per phase × role** — a matrix test over `EventShell`, asserting which tabs exist.
   This is cheap and it locks in the IA.
4. **`/me`** — correct next match, partner and opponents for the signed-in player; correct empty and
   sitting-out states; still renders after completion.
5. **Run-of-show gating** — each step's enabled/disabled state per phase, and explicitly that reveal
   is **not** blocked by an unresolved rating-review queue (D-029).

Do not weaken existing tests to make new code pass. If an existing test genuinely encodes behaviour
this redesign changes, say so explicitly in your report rather than quietly rewriting it.

### End-to-end / smoke tests — spike, recommend, then build

This is exploratory and I want a recommendation before a large investment. There is currently **no
E2E framework** in the repo. What does exist:

- `puppeteer-core` + `chrome-launcher` as devDependencies, already driving real Chrome in
  `scripts/measure-load.mjs`.
- A full local Supabase stack with seed data: `npm run db:start`, `npm run db:reset`,
  `npm run dev:local` (pinned to `http://127.0.0.1:5173`, `strictPort: true` — auth redirects depend
  on that exact origin).
- CI at `.github/workflows/ci.yml`: format → lint → test → build, on PR and push to `main`.

Deliver, in this order:

1. **A short written comparison** (in your report, not a new doc unless it earns one) of Playwright
   vs. extending the existing puppeteer-core harness. Cover: cost of the new dependency and CI
   runtime, whether local Supabase can be seeded and reset per run, and how to handle auth — the app
   uses PIN/magic-link plus a **trusted-device** gate (`require_trusted_device()`), which E2E must
   satisfy to exercise voting and score entry. Auth is the part most likely to sink this; assess it
   honestly and early.
2. **A working smoke test of one path** in whichever tool you recommend, as a spike. Suggested path,
   because it crosses every seam this redesign touches: load a deep link to
   `/events/:id/schedule` cold → admin enters the last score → finishes the tournament → confirms a
   player still cannot see standings → opens Oscars voting → a player votes → closes voting →
   reveals → player sees standings and Oscars winners.
3. **A recommendation on CI**: whether this runs per-PR, nightly, or locally-only before a release.
   Do not add a slow or flaky job to the PR gate without saying so.

If the spike shows E2E is not worth it yet — the trusted-device gate is a plausible reason — say that
plainly and propose the alternative (for example, route-level integration tests with a mocked
Supabase client, which would cover most of the same seams far more cheaply). A well-argued "not yet"
is an acceptable outcome. A silent skip is not.

## Definition of done

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run format:check` and `npm run build` all
  clean.
- All five defects have failing-before/passing-after tests.
- No parallel old/new paths left behind; retired routes redirect.
- `ARCHITECTURE.md` updated for the new route map and the phase model.
- `docs/matchmaking-v2/PLAN.md` §1 updated.
- A summary of what changed, what you deleted, and anything you deliberately left alone.

## Checkpoints — stop and check in

Do not build the whole thing before showing me anything.

1. After **workstream A** — the phase model and its tests. This is the spine; if the phase
   definitions are wrong, everything built on them is wrong. Show me the module and the test table.
2. After **workstream B** — routing, guards and tab gating, with the deep-link and Oscars-lockout
   regression tests passing.
3. After the **E2E spike** — before building out a full suite.

Between checkpoints, work autonomously. Do not ask permission for individual file edits.

## Out of scope — do not touch

- Matchmaking / rating engine internals (`src/features/matchmaking/domain/**`). You will call
  `applyTournamentRatings` from the run-of-show; do not change how it computes anything.
- The two items under "Known Open Work" in `CLAUDE.md`: the PII-dump quota in
  `get_all_players_with_pii_v2`, and dropping the `players.pin` plaintext column. Both are separate
  PR-sized pieces of work.
- The league feature (`src/features/league/**`) and merch (`src/features/merch/**`).
- Score entry permissions — admin-only is decided.
- Any change that requires a database migration. If you think you need one, stop and ask.

## A note on how to work

If you find something the review got wrong, say so — it was written from a read of the code, not from
running it, and file/line references will have drifted. If you disagree with a recommendation, make
the argument before implementing something different. If you hit a genuine blocker, finish everything
that does not depend on it first, then surface the question.
