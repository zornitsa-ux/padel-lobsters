-- Security hardening Phase E: storage policy tightening
--
-- Both buckets (avatars, merch) are PUBLIC (reads served by CDN, no SELECT
-- policy needed). Only write operations need RLS.
--
-- Avatar upload convention (src/api/avatars.js):
--   - Stable own-avatar: 'player-{player_id}.webp'  (profile settings)
--   - Admin random:      'player-{timestamp}-{random}.webp'  (admin player form)
-- → authenticated users may upload/update their own stable file; admins can
--   upload any file in the bucket.
--
-- Merch bucket is admin-only for all write operations.
-- No DELETE policy existed for avatars and none is added (upsert overwrites).

-- ── avatars ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public upload to avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public update avatars"    ON storage.objects;

CREATE POLICY "Player or admin upload avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (
      name = 'player-' || auth.uid()::text || '.webp'
      OR public.is_admin()
    )
  );

CREATE POLICY "Player or admin update avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      name = 'player-' || auth.uid()::text || '.webp'
      OR public.is_admin()
    )
  );

-- ── merch ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public upload to merch" ON storage.objects;
DROP POLICY IF EXISTS "Public update merch"    ON storage.objects;
DROP POLICY IF EXISTS "Public delete merch"    ON storage.objects;

CREATE POLICY "Admin upload merch" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'merch' AND public.is_admin());

CREATE POLICY "Admin update merch" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'merch' AND public.is_admin());

CREATE POLICY "Admin delete merch" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'merch' AND public.is_admin());
