-- ============================================================================
--  v15 — Merch cleanup + external order tracking
--
--  1) Delete test orders placed by Zornitsa Mihaylova (tester account).
--     Matches on name to avoid hard-coding the player id. If you have
--     multiple Zornitsas in the group, tighten the WHERE clause first.
--
--  2) Add an `external_orders` column to merch_items so the admin can
--     track purchases that happened outside the app (e.g. in-person or
--     over WhatsApp). The shop page will add this to the live website
--     count so players see the true total — FOMO fuel.
--
--  3) Seed the technical shirt with 1 external order to reflect the
--     one that was already placed outside the app.
-- ============================================================================

-- 1) Wipe Zornitsa's test orders. Run the SELECT first to eyeball what
--    you're about to delete, then uncomment/run the DELETE.
SELECT mi.id, mi.merch_item_id, mi.player_id, mi.size, mi.status, p.name
FROM   merch_interests mi
LEFT JOIN players p ON p.id::text = mi.player_id
WHERE  p.name ILIKE '%zornitsa%mihaylova%';

DELETE FROM merch_interests
WHERE  player_id IN (
  SELECT id::text FROM players WHERE name ILIKE '%zornitsa%mihaylova%'
);


-- 2) External orders column (idempotent — safe to re-run)
ALTER TABLE merch_items
  ADD COLUMN IF NOT EXISTS external_orders INTEGER NOT NULL DEFAULT 0;


-- 3) Seed the one known offline order: 1× technical shirt.
--    Tweak the name match if yours is called something else (e.g.
--    "Performance Tee"). The LIMIT 1 guard avoids accidentally
--    stamping multiple items if the name is ambiguous.
UPDATE merch_items
SET    external_orders = 1
WHERE  id = (
  SELECT id FROM merch_items
  WHERE  name ILIKE '%technical%shirt%'
  ORDER  BY id
  LIMIT  1
);

-- Verification: confirm counts look right
SELECT id, name, external_orders,
       (SELECT COUNT(*) FROM merch_interests mi
        WHERE mi.merch_item_id = merch_items.id
          AND COALESCE(mi.status, 'ordered') <> 'cancelled') AS website_orders
FROM   merch_items
WHERE  active = true
ORDER  BY display_order NULLS LAST, id;
