-- Restore write privileges on public.settings to authenticated.
--
-- Phase C (20260518000008) ran REVOKE ALL then re-granted per table, but listed
-- settings only under GRANT SELECT — it was omitted from the INSERT/UPDATE/DELETE
-- grant. Table privileges are checked before RLS, so every client write to
-- settings has failed with "permission denied for table settings" (403) since
-- then, for admins included. settings_admin_write was never reached.
--
-- Writes stay admin-only: RLS is enabled on settings and settings_admin_write
-- (FOR ALL, USING + WITH CHECK on app_metadata.role = 'admin') is the only
-- policy covering INSERT/UPDATE. settings_read_all is SELECT-only.
--
-- INSERT is required alongside UPDATE because the client saves via upsert.
-- No DELETE: the single settings row is never removed from the client.

grant insert, update on public.settings to authenticated;
