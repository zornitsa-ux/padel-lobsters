-- The Lobster Way (FAQ) content, admin-editable from the app. Stored as a
-- single JSONB column on the existing single-row settings table, same
-- pattern as padel_tips. Shape: array of category objects —
-- { slug, label, chipEmoji, isStory?, story?, items?: [{ q, a, list?, steps?, note? }] }
--
-- Applied to production out-of-band on 2026-08-05 as version 20260805110159.
-- This file backfills the repo with the statement that actually ran; it was
-- originally committed as 20260721000000, a timestamp that sorted before four
-- migrations already live on prod.
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS lobster_way_content jsonb NULL;
