# CLAUDE.md

## Code Style

- Reserve comments for complex or critical code only. When writing one, be succinct and factual — no narration of what the code does.
- Keep functions short and single-purpose.
- Prefer named arguments (destructured objects) over positional parameters.
- Prefer pure functions and immutability.
- Refactor as you work. If you spot repeated code, create a task to de-duplicate it with a clean extraction rather than leaving it.

## UI and Design System

See `docs/design-system/` (TOKENS.md for tokens, PLAN.md for what's being built).

- Build UI from `src/components/ui` first. Check what exists before writing markup for an alert, badge, button, empty state, row or card header.
- If a ui component doesn't fit, add the variant or prop to the component. Don't hand-roll a copy in the feature.
- Keep `className` on ui components to layout, and use it sparingly. When the same class keeps appearing on a component across features (`w-full`, `flex-1`, a fixed margin), bring it into the component as a prop or a layout component instead of repeating it.
- Colours come from `lob-*` tokens: `lob-success`, `lob-warning`, `lob-danger`, `lob-info` (with `-light`, `-soft`, `-border`, `-on-dark`, `-solid`, `-strong`), plus `lob-well`, `lob-line`, `lob-line-strong`. Never raw Tailwind palette classes (`text-red-600`, `bg-amber-50`) or hex literals (`bg-[#…]`).
- `npm run design:check` (in CI) fails if a file gains raw palette classes or hand-built `<button>`s outside `src/components/ui`. If you remove some, run `npm run design:baseline` and commit the updated baselines.
- Ui components don't carry their own spacing. The parent or a layout component (`ActionRow`, `space-y-*`) places them.
- Need a colour or size with no token? Add the token to `tailwind.config.js` and TOKENS.md in the same PR rather than using a raw value.

### Admin actions on behalf of others

- Admins keep the power to act for any player. Wherever an admin picks a player other than themselves (captain, partner, registrant, payer), make it unmistakable who was picked.
- Name the chosen player in the form, and confirm with `useConfirmOnBehalf` (`src/lib/confirmOnBehalf.ts`), restating who and what, before the write. Never default silently to someone else.
- Admin-only forms should look different from the player-facing ones.

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
