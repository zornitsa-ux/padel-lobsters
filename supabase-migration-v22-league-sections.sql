-- ============================================================================
--  v22 — Editable league description sections
--
--  The League page renders 6 collapsible info sections (Welcome, How It
--  Works, Timeline, Rules, Scoring, Finals). Until now their body text was
--  hardcoded in the React component. Admins want to tweak the copy without
--  a deploy.
--
--  Add a jsonb column to the leagues table keyed by section id:
--
--    description_sections = {
--      "welcome":  "Join us for …",
--      "how":      "Group stage runs …",
--      "rules":    "Golden point …",
--      ...
--    }
--
--  Missing keys fall back to DEFAULT_SECTIONS in League.jsx, so admins can
--  override any subset of sections without filling in the rest.
--
--  Idempotent — safe to re-run.
-- ============================================================================

alter table leagues
  add column if not exists description_sections jsonb default '{}'::jsonb;
