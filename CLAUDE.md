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
- Do not write to the production database by any other route either: no `apply_migration` or write SQL through the Supabase MCP, and no SQL in the dashboard. Read-only queries are fine.
- Before review, test migrations locally only (`npm run db:reset`, or `npx supabase migration up --local`, plus any script in `supabase/tests/`).
