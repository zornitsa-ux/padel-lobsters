# Release script

`npm run release` (`scripts/release/`) replaces three manual steps after a merge: `db push`,
`functions deploy` and the production grants check. `release:plan` is the read-only half.

## Why

Edge Function deploys were a separate manual step nothing reminded anyone about; `verify-pin` sat
on a May build for months. Migrations and grants had the same shape: correct when remembered.

## Flow

1. **Preflight.** On `main`, clean tree, equal to `origin/main`; installed CLI equals the
   `package.json` pin; project linked; every CI workflow run for the commit is green (newest run
   per workflow wins). Any failure stops the release. There is no skip flag: the migration rule
   (merged and reviewed first) has no urgency exception.
2. **Plan.** Pending migrations come from `migration list --remote` (local without remote). A
   remote migration the repo lacks stops the release. A function is stale when its newest commit
   on `main` (or `supabase/functions/_shared`) is later than its `updated_at` in production, or
   it was never deployed.
3. **Confirm.** Needs a TTY. The person types the linked project ref. Nothing else confirms. This
   keeps scripts and CI from shipping by accident; it does not stop a deliberate agent with a
   pseudo-terminal, so the CLAUDE.md rule that agents never run it still applies.
4. **Apply.** `db push --remote --yes`, then `functions deploy <name> --yes` for each stale
   function. `--functions-first` reverses the order, for a PR whose description says so.
5. **Verify.** Re-reads state: nothing pending, no remote-only migrations, no stale function;
   `dump-grants.sh --check --remote` shows no grants drift; auth integrity counts are printed
   for information. Problems are reported together and exit non-zero.

## Decisions

- **Staleness by timestamp, not content hash.** The CLI exposes no deployed hash. A manual deploy
  from a branch newer than `main`'s commit hides a stale function; `--redeploy-functions` is the
  remedy.
- **Plan logic is pure** (`plan.ts`, tested in `plan.test.ts`); `release.ts` only shells out.
- **A failed migration is never edited.** Write a new migration that fixes it (CONTRIBUTING.md).

## Not covered

A post-deploy smoke test against production, and a scheduled drift check in CI (needs a
read-only token). Both reuse the verify step.
