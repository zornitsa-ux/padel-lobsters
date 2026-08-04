-- The Lobster Way (FAQ) content, admin-editable from the app. Stored as a
-- single JSONB column on the existing single-row settings table, same
-- pattern as padel_tips. Shape: array of category objects —
-- { slug, label, chipEmoji, isStory?, story?, items?: [{ q, a, list?, steps?, note? }] }
alter table public.settings add column if not exists lobster_way_content jsonb;
