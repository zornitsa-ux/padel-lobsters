import { test as setup } from '@playwright/test'
import { signIn } from './fixtures/auth'
import { ADMIN, PLAYER } from './fixtures/seed'
import { SESSION_FILES } from './fixtures/sessions'

/* Signs in once per role and saves the session (Supabase keeps it in
   localStorage), so specs start signed in with `test.use({ storageState })`. */

for (const [role, account] of [
  ['admin', ADMIN],
  ['player', PLAYER],
] as const) {
  setup(`sign in as ${role}`, async ({ page }) => {
    await signIn({ page, email: account.email, password: account.password, at: '/events' })
    await page.context().storageState({ path: SESSION_FILES[role] })
  })
}
