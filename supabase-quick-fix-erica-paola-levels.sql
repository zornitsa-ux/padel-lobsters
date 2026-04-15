-- ============================================================================
--  Quick fix — bump Erica's and Paola's Playtomic levels.
--    • Erica: +0.3 (target adjusted = 1.6)
--    • Paola: +0.8 (target adjusted = 1.8)
--
--  We bump playtomic_level directly and recompute adjusted_level so the
--  badge on the Players page reflects the new total. adjustment stays
--  untouched so any earlier admin tweak is preserved.
--
--  Run the SELECTs first to eyeball the rows, then run the UPDATEs.
-- ============================================================================

-- Pre-check: confirm we're targeting the right rows.
SELECT id, name, playtomic_level, adjustment, adjusted_level
FROM   players
WHERE  name ILIKE '%erica%' OR name ILIKE '%paola%';

-- Erica: +0.3 to playtomic, recompute adjusted.
UPDATE players
SET    playtomic_level = COALESCE(playtomic_level, 0) + 0.3,
       adjusted_level  = COALESCE(playtomic_level, 0) + 0.3 + COALESCE(adjustment, 0)
WHERE  name ILIKE '%erica%';

-- Paola: +0.8 to playtomic, recompute adjusted.
UPDATE players
SET    playtomic_level = COALESCE(playtomic_level, 0) + 0.8,
       adjusted_level  = COALESCE(playtomic_level, 0) + 0.8 + COALESCE(adjustment, 0)
WHERE  name ILIKE '%paola%';

-- Verification
SELECT id, name, playtomic_level, adjustment, adjusted_level
FROM   players
WHERE  name ILIKE '%erica%' OR name ILIKE '%paola%';
