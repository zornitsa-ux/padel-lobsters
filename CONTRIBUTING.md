# Contributing to Padel Lobsters

## Working with the database

### Local database commands

| Command                                            | What it does                                               |
| -------------------------------------------------- | ---------------------------------------------------------- |
| `npm run db:start`                                 | Start local Supabase (Postgres + Auth + Studio)            |
| `npm run db:stop`                                  | Stop the local stack                                       |
| `npm run db:reset`                                 | Wipe and recreate the local DB from migrations + seed data |
| `npm run db:migration -- <name>`                   | Create a new empty migration file                          |
| `npm run db:test`                                  | Run the database tests in `supabase/tests`                 |
| `npm run rehearsal:sync`                           | Replace the local DB with production data (see below)      |
| `npm run rehearsal:integrity -- --local\|--linked` | Auth integrity counts, local or production (read-only)     |

### Seed data

`supabase/seed.sql` is a small synthetic world: made-up players (no real
names, since the repo is public), one event of each kind, a league in its
group stage, shop items and Oscars. Dates are relative to the day of the
reset, and IDs are fixed so the e2e specs can find them
(`e2e/fixtures/seed.ts`). Its header lists the sign-in accounts.

Keep it small and keep it synthetic. When a feature needs data to show, add
one example to the seed and its IDs to `e2e/fixtures/seed.ts`. For
production-like data, use `npm run rehearsal:sync` instead.

### Creating a database migration

```bash
# 1. Create a migration file
npm run db:migration -- add_birthday_column

# 2. Write the SQL in the new file under supabase/migrations/

# 3. Test it locally — replays ALL migrations from scratch + seeds
npm run db:reset
npm run db:test   # plus a test in supabase/tests for what the migration enforces

# 4. Commit the migration file and open a PR
```

### Rehearsing a migration on production data

For migrations that touch players or auth, rehearse on a copy of production
before review:

```bash
git checkout main && npm run rehearsal:sync   # production data, credentials wiped
git checkout <pr-branch> && npx supabase migration up --local
npm run rehearsal:integrity -- --local
npm run db:reset                               # back to seed data when done
```

The PR branch must contain every migration on `main`, or `migration up`
refuses. Paste counts into the PR, never names or emails. `sync.sh` lists its
safety checks at the top.

**Never run SQL manually in the production Supabase dashboard.** All schema
changes go through migration files so they're tracked in Git, reviewed in PRs,
and reproducible on every developer's machine.

### Applying migrations to production

This is a **manual step** — it is not automated in CI/CD. After a migration
PR is merged, someone with production access runs, from `main` (so exactly
what was reviewed and merged gets applied):

```bash
git checkout main && git pull
npx supabase db push
```

`db push` diffs local `supabase/migrations/` against the remote
`supabase_migrations.schema_migrations` table and applies only unapplied
migrations. If a migration fails on production, do not edit or delete the
failed file — write a new migration that fixes the issue.

### Deploying Edge Functions

Also manual, and also only from `main` after merge. A PR that changes
anything under `supabase/functions/<name>/` must be followed by:

```bash
git checkout main && git pull
npx supabase functions deploy <name>
```

Nothing else deploys them, so a merged change stays dormant until someone
runs this. `verify-pin` sat on a May build for months this way, resetting
players' auth emails on every PIN sign-in. When a PR touches both a function
and migrations, its description should say which goes first.

---

## End-to-end tests

`npm run test:e2e` drives Chrome through the app (Playwright) against the
local stack. CI runs it, after `npm run db:test`, on every PR that touches
`src/`, `supabase/`, `e2e/` or the dependencies, and nightly
(`.github/workflows/e2e.yml`).

```bash
npm run db:start && npm run db:reset   # the specs expect the seed
npm run test:e2e                       # starts dev:local unless it's running
```

If sign-in emails arrive without a code, the stack started before the email
templates changed: `npm run db:stop && npm run db:start`.

- **Specs.** `player-views` (every page, signed out and as a player),
  `player-flows` (what a player writes, read back from the database),
  `email-sign-in`, `tournament-flow` (admin and player run of show).
- **Fixtures** (`e2e/fixtures/`). Import `test` and `expect` from
  `fixtures/test.ts`: it fails a test on any uncaught error or console error
  (`allowConsoleErrors` for one the test causes on purpose; known app bugs
  are listed there with their issue). `auth.setup.ts` saves a signed-in
  session per role, so a spec starts signed in with
  `test.use({ storageState: SESSION_FILES.player })`. `openAs` opens a
  second browser for another account.
- **Data.** Read the seed; never change it. A spec that writes creates its
  own event or player (`createEvent`, `createPlayer`), checks what was stored
  through the database (`admin`, `sql` in `fixtures/db.ts`) and deletes it in
  `finally`. The suite has to pass twice in a row without a reset.
- **Real input.** Click and type as a person would. Never `dispatchEvent` or
  a scripted `.click()`: menus and dialogs have broken in ways only real input
  shows (#88).
- **New pages and flows** get a check in the matching spec in the same PR.
- **A known app bug** that fails a test: open an issue and mark the test
  `test.fail(true, '… #NN')`, so it goes red again once the bug is fixed.

---

## Pre-commit hook

Commits run Prettier + ESLint on changed files automatically (Husky). A
problem neither tool can auto-fix blocks the commit with an error pointing at
the file/line.

---

## Project structure (quick reference)

```
padel-lobsters/
├── .github/workflows/   CI pipeline (GitHub Actions)
├── e2e/                  End-to-end specs and fixtures (Playwright)
├── src/
│   ├── features/         Primary code organization — see ARCHITECTURE.md
│   │                      for the domain/application/state/ui layer shape
│   ├── components/       Older shared components not yet migrated to features/
│   ├── context/          App-wide state (AppContext)
│   ├── data/              Static content (tips, league text)
│   └── lib/               Pure utility functions
└── supabase/
    ├── functions/         Edge Functions (server-side code)
    ├── migrations/        Database migrations (applied in order)
    ├── tests/             Database tests (npm run db:test)
    └── seed.sql           Synthetic data for local development and e2e
```
