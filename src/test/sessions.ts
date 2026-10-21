// Tests describe a signed-in user as `{ user: { app_metadata: { role } } }`; the app reads the
// role from the token (C-12) through useApp(), so mocks of useApp pair the two.
export const fixtureAuth = (session: unknown) => {
  const meta = (session as { user?: { app_metadata?: { role?: string } } } | null)?.user
    ?.app_metadata
  const role = meta?.role ?? 'guest'
  return { session, role, isAdmin: role === 'admin' }
}
