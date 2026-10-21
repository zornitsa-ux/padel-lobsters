// Tests describe a signed-in user as `{ user: { app_metadata: { role } } }`; the app reads the
// role from the token (C-12) through useApp().role, so mocks of useApp pair the two.
export const fixtureRole = (session: unknown): string => {
  const meta = (session as { user?: { app_metadata?: { role?: string } } } | null)?.user
    ?.app_metadata
  return meta?.role ?? (session ? 'guest' : 'guest')
}
