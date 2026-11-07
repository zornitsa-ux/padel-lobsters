import type { Page } from '@playwright/test'

/** Fills the "Join the Lobsters" form. A unique name: a roster match would block the submit. */
export async function fillSignupForm({ page, email }: { page: Page; email: string }) {
  await page.getByPlaceholder('e.g. Augustin').fill('Eve')
  await page.getByPlaceholder('e.g. Tapia').fill(`Nightly${Date.now()}`)
  await page.getByPlaceholder('player@email.com').fill(email)
  await page.getByPlaceholder('+31612345678').fill('+31611111111')
  await page.getByPlaceholder('e.g. 3.5').fill('2.5')
  await page.getByRole('button', { name: /^female$/i }).click()
  await page.getByPlaceholder(/select country/i).fill('Netherlands')
  await page.getByRole('button', { name: /netherlands/i }).click()
}
