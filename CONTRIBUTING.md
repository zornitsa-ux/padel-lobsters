# Contributing to Padel Lobsters

## Working with the database

### Local database commands

| Command                          | What it does                                               |
| -------------------------------- | ---------------------------------------------------------- |
| `npm run db:start`               | Start local Supabase (Postgres + Auth + Studio)            |
| `npm run db:stop`                | Stop the local stack                                       |
| `npm run db:reset`               | Wipe and recreate the local DB from migrations + seed data |
| `npm run db:migration -- <name>` | Create a new empty migration file                          |

### Creating a database migration

```bash
# 1. Create a migration file
npm run db:migration -- add_birthday_column

# 2. Write the SQL in the new file under supabase/migrations/

# 3. Test it locally — replays ALL migrations from scratch + seeds
npm run db:reset

# 4. Commit the migration file and open a PR
```

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
    └── seed.sql           Sample data for local development
```
