-- Run by the CLI before migrations on `supabase start` and `db reset`; never by
-- `db push`. Since CLI v2.115 the local stack no longer installs pg_net unless
-- [experimental.webhooks] is on, which would also make `config push` change
-- production. Hosted projects already have it. Starting from a backup skips this
-- file, so `npm run db:start` applies it again.
create extension if not exists pg_net schema extensions;
