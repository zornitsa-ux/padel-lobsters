import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { guardPage } from './test'

/**
 * Password sign-in through the app's sign-in form, at `at` when given. The
 * gate closing isn't enough: a navigation before the session is stored lands
 * signed out, so it also waits for the network to settle.
 */
export async function signIn({
  page,
  email,
  password,
  at,
}: {
  page: Page
  email: string
  password: string
  at?: string
}) {
  if (at) await page.goto(at)
  await page.getByRole('button', { name: /sign in with password/i }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0)
  await page.waitForLoadState('networkidle')
}

const SIGNED_OUT = { cookies: [], origins: [] }

/**
 * A browser for another account, beside the test's own page. Contexts made
 * from `browser` inherit the test's saved session, so this starts empty. The
 * page is guarded like the test's own: check `errors` is empty at the end, and
 * close the context.
 */
export async function openAs({
  browser,
  email,
  password,
}: {
  browser: Browser
  email: string
  password: string
}): Promise<{ context: BrowserContext; page: Page; errors: string[] }> {
  const context = await browser.newContext({ storageState: SIGNED_OUT })
  const page = await context.newPage()
  const errors = await guardPage({ page })
  await signIn({ page, email, password, at: '/events' })
  return { context, page, errors }
}
