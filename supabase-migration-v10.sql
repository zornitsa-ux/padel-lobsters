-- v10: Add display_order to merch_items for drag-and-drop reordering
alter table merch_items add column if not exists display_order integer default 0;

-- Backfill existing items so they keep their current id-based order
update merch_items set display_order = id where display_order = 0;
