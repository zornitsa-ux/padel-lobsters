import { test as base, type ConsoleMessage, type Page } from '@playwright/test'

// Console errors the app is known to log, each an open issue. Remove the entry
// when the issue is fixed.
const KNOWN_CONSOLE_ERRORS: { pattern: RegExp; issue: number }[] = [
  { pattern: /get_results: .*invalid input syntax for type uuid: ""/, issue: 98 },
  { pattern: /lobster_oscars_get_results/, issue: 98 },
]

const allowedByPage = new WeakMap<Page, RegExp[]>()

/** For a test that provokes an error on purpose (a rejected code, a weak password). */
export function allowConsoleErrors({ page, patterns }: { page: Page; patterns: RegExp[] }) {
  allowedByPage.set(page, [...(allowedByPage.get(page) ?? []), ...patterns])
}

function consoleLine(message: ConsoleMessage): string {
  return `${message.text()} (${message.location().url})`
}

/**
 * Collects a page's uncaught errors and console errors, and dismisses the
 * monthly "update your Playtomic level" prompt, which opens over Account in any
 * fresh browser. Read the returned list at the end of the test.
 */
export async function guardPage({ page }: { page: Page }): Promise<string[]> {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`Uncaught: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = consoleLine(message)
    const allowed = [
      ...KNOWN_CONSOLE_ERRORS.map(({ pattern }) => pattern),
      ...(allowedByPage.get(page) ?? []),
    ]
    if (!allowed.some((pattern) => pattern.test(text))) errors.push(text)
  })
  await page.addLocatorHandler(page.getByRole('button', { name: /^no change$/i }), (button) =>
    button.click(),
  )
  return errors
}

/** Every spec imports `test` from here, so every page is guarded. */
export const test = base.extend({
  page: async ({ page }, provide) => {
    const errors = await guardPage({ page })
    await provide(page)
    if (errors.length) throw new Error(`Page errors:\n${errors.join('\n')}`)
  },
})

export { expect } from '@playwright/test'
