-- Clear password hashes the app never set (docs/pin-auth-removal F-4, D-9).
--
-- No app path has ever set a password, yet 44 production auth users created in
-- May 2026 carry a hash. Each one is a live credential on the password grant
-- whose plaintext nobody controls. Passwordless GoTrue users hold NULL here, so
-- every non-null value is orphaned. Sessions are untouched.

update auth.users
   set encrypted_password = null
 where encrypted_password is not null;
