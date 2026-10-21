# CLAUDE.md

## Code Style

- Reserve comments for complex or critical code only. When writing one, be succinct and factual — no narration of what the code does.
- Keep functions short and single-purpose.
- Prefer named arguments (destructured objects) over positional parameters.
- Prefer pure functions and immutability.
- Refactor as you work. If you spot repeated code, create a task to de-duplicate it with a clean extraction rather than leaving it.

## Database Migrations

- Never apply a migration to production before its PR has been code reviewed and merged. This applies to every developer and agent, with no exceptions for urgency.
- Production migrations run only from `main` after merge, via `npx supabase db push` (see CONTRIBUTING.md, "Applying migrations to production").
- Do not write to the production database by any other route either: no `apply_migration` or write SQL through the Supabase MCP, and no SQL in the dashboard. Read-only queries are fine. The one exception is the Jon-run path below.
- Before review, test migrations locally only (`npm run db:reset`, or `npx supabase migration up --local`, plus any script in `supabase/tests/`).

### One-off data fixes and player information

The repo is public. Anything committed, pushed, or put in a PR title, description or comment is visible to everyone, including edit history, and can't be fully removed afterwards.

- One-off data fixes (merging duplicates, repointing rows, cleaning up a single player or team) are not migrations. Do not write them as migration files.
- Never commit, push, or put in a PR any SQL, comment, test fixture or description that names players or contains their emails or IDs. This applies to migrations too, if they would expose player information.
- For these, draft the SQL in the scratchpad, rehearse it locally in a rolled-back transaction, and hand it to **Jon**, who runs it directly against production. Never run it yourself.
- It must be Jon, not another developer: Jon is the most qualified to review the SQL by hand, and that human review replaces the PR review for these changes.
- Give Jon the SQL with a short summary of what it changes and the checks you ran. Keep names out of anything that gets committed.
