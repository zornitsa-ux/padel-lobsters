-- ============================================================================
--  v20c — League phase date ranges
--
--  The initial v20 schema only had a single starts_at / ends_at pair, which
--  turned out not to be enough. Admins want to set an explicit date range
--  per competition phase so the League page can render a proper timeline:
--
--    Signups                Now → <signup_closes_at>
--    Group Stage            group_stage_start → group_stage_end
--    Quarterfinals          quarters_start    → quarters_end          (optional)
--    Semifinals             semis_start       → semis_end
--    Finals                 finals_start      → finals_end
--
--  Quarterfinals is optional — only filled when the league ends up with
--  12+ teams per division and needs a QF round. The UI renders it
--  conditionally.
--
--  Idempotent — safe to re-run.
-- ============================================================================

alter table leagues
  add column if not exists group_stage_start date,
  add column if not exists group_stage_end   date,
  add column if not exists quarters_start    date,
  add column if not exists quarters_end      date,
  add column if not exists semis_start       date,
  add column if not exists semis_end         date,
  add column if not exists finals_start      date,
  add column if not exists finals_end        date;

-- Keep the old starts_at / ends_at columns around for any older rows —
-- they now duplicate group_stage_start / finals_end. Can be dropped once
-- all league records have been re-saved with the new fields.
