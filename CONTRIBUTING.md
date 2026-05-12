# Contributing to Padel Lobsters

This guide explains how to work on the project safely without affecting the
live site. It covers setup, daily workflow, and how changes get reviewed.

---

## Prerequisites

You need these installed on your computer:

| Tool               | Why                     | Install                                                                               |
| ------------------ | ----------------------- | ------------------------------------------------------------------------------------- |
| **Node.js 20**     | Runs the app            | [nodejs.org](https://nodejs.org/) (LTS) or use `nvm` / `fnm`                          |
| **Docker Desktop** | Runs the local database | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) |
| **Git**            | Version control         | [git-scm.com](https://git-scm.com/) or GitHub Desktop                                 |

> **Windows users**: Docker Desktop requires WSL 2. Follow the prompts during
> install — it will enable it for you.

---

## First-time setup

```bash
# 1. Clone the repo
git clone https://github.com/<your-org>/padel-lobsters.git
cd padel-lobsters

# 2. Install JavaScript dependencies
npm install

# 3. Copy the local dev environment file
cp .env.localdev.example .env.localdev

# 4. Start the local Supabase stack (requires Docker running)
npm run db:start
#    This prints local URLs and keys. The .env.localdev.example already
#    contains the default values, so you usually don't need to change anything.

# 5. Seed the local database with sample data
npm run db:reset

# 6. Start the dev server
npm run dev:local
#    Open http://localhost:5173 — you're running entirely locally!
```

---

## Daily workflow

### 1. Create a branch for your work

Never commit directly to `main`. Always create a branch:

```bash
git checkout main
git pull
git checkout -b my-feature-name
```

### 2. Make your changes

Run `npm run dev:local` and edit files. The browser refreshes automatically.

### 3. Commit

When you save and commit, a **pre-commit hook** runs automatically:

- **Prettier** formats your changed files
- **ESLint** checks for common mistakes

If either tool finds a problem it can't auto-fix, the commit will be blocked
with an error message telling you what to fix.

### 4. Push and open a Pull Request

```bash
git push -u origin my-feature-name
```

Then open a **Pull Request** on GitHub. This triggers:

- **CI checks** (formatting, lint, build) — must pass before merging
- **Vercel preview deploy** — a temporary URL where you can test your changes
  on a real server without affecting the live site

### 5. Merge

Once CI is green and the preview looks good, merge the PR into `main`.
Vercel automatically deploys `main` to the live site.

---

## Working with the database

### Local database commands

| Command                          | What it does                                               |
| -------------------------------- | ---------------------------------------------------------- |
| `npm run db:start`               | Start local Supabase (Postgres + Auth + Studio)            |
| `npm run db:stop`                | Stop the local stack                                       |
| `npm run db:reset`               | Wipe and recreate the local DB from migrations + seed data |
| `npm run db:migration -- <name>` | Create a new empty migration file                          |

### Creating a database migration

When you need to change tables, columns, RLS policies, or functions:

```bash
# 1. Create a migration file
npm run db:migration -- add_birthday_column

# 2. Write the SQL in the new file under supabase/migrations/
#    You can write the SQL yourself (CREATE TABLE, ALTER TABLE, etc.)
#    or ask your AI agent to generate it — just review the output before
#    committing.

# 3. Test it locally
npm run db:reset
#    This replays ALL migrations from scratch + seeds. If it fails, fix the SQL.

# 4. Commit the migration file and open a PR
```

**Never run SQL manually in the production Supabase dashboard.** All schema
changes go through migration files so they're tracked in Git, reviewed in PRs,
and reproducible on every developer's machine.

### Applying migrations to production

After a migration PR is merged to `main`, someone with production access must
push the new migration(s) to the remote database. This is a **manual step** —
it is not automated in CI/CD.

```bash
# One-time setup: link the CLI to the production project
npx supabase link --project-ref <your-project-ref>

# From the main branch, after pulling the latest:
git checkout main && git pull
npx supabase db push
```

- Always run `db push` from **`main`** so you're applying exactly what was
  reviewed and merged.
- The command compares your local `supabase/migrations/` against the remote
  `supabase_migrations.schema_migrations` table and runs only the new
  (unapplied) migrations.
- If a migration fails on production, **do not** delete or edit the failed
  file. Instead, create a new migration that fixes the issue.

---

## Code quality tools

| Command                | What it does                            |
| ---------------------- | --------------------------------------- |
| `npm run lint`         | Check all files with ESLint             |
| `npm run lint:fix`     | Auto-fix what ESLint can                |
| `npm run format`       | Format all files with Prettier          |
| `npm run format:check` | Check formatting without changing files |

These run automatically on commit (via the pre-commit hook), so you usually
don't need to run them manually.

---

## Project structure (quick reference)

```
padel-lobsters/
├── .github/workflows/   CI pipeline (GitHub Actions)
├── .husky/              Git hooks (pre-commit)
├── public/              Static assets
├── src/
│   ├── components/      React components (one per page/feature)
│   ├── context/         App-wide state (AppContext)
│   ├── data/            Static content (tips, league text)
│   └── lib/             Pure utility functions
├── supabase/
│   ├── config.toml      Local Supabase configuration
│   ├── functions/       Edge Functions (server-side code)
│   ├── migrations/      Database migrations (applied in order)
│   └── seed.sql         Sample data for local development
└── package.json         Dependencies and scripts
```

---

## Setting up branch protection on GitHub

A repository admin needs to do this once:

1. Go to **Settings → Branches** on your GitHub repo
2. Click **Add branch protection rule**
3. Branch name pattern: `main`
4. Enable:
   - ✅ **Require a pull request before merging**
   - ✅ **Require status checks to pass before merging**
     - Search for and add: `Lint & Build`
   - ✅ **Require branches to be up to date before merging**
5. Click **Create**

After this, nobody (including admins) can push directly to `main`. All changes
go through PRs with passing CI.

---

## Troubleshooting

**"Docker is not running"** when running `db:start`
→ Open Docker Desktop and wait for it to finish starting.

**Pre-commit hook fails on formatting**
→ Run `npm run format` to fix all files, then commit again.

**ESLint errors blocking commit**
→ Read the error message — it tells you the file and line. Fix the issue,
then commit again. If you're stuck, ask for help.

**`npm run dev:local` shows a blank page**
→ Make sure `npm run db:start` is running and `.env.localdev` exists.
