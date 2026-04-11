-- v12: Order status system with cancel + comment
-- Status: 'ordered' | 'paid' | 'delivered' | 'cancelled'
alter table merch_interests add column if not exists status text default 'ordered';
alter table merch_interests add column if not exists admin_comment text default '';
alter table merch_interests add column if not exists cancelled_at timestamptz;

-- Backfill existing orders: if already marked paid/delivered, set status accordingly
update merch_interests set status = 'delivered' where delivered = true;
update merch_interests set status = 'paid' where paid = true and delivered = false;
update merch_interests set status = 'ordered' where status is null or status = '';
