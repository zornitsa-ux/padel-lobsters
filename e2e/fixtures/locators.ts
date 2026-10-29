import type { Locator, Page } from '@playwright/test'

type Scope = Page | Locator

/**
 * The input or textarea right after a visible label. Most labels aren't tied to
 * their input (#103), so `getByLabel` can't find them; switch to it once they are.
 */
export function fieldAfterLabel({ scope, label }: { scope: Scope; label: string }): Locator {
  return scope.locator(`label:text-is(${JSON.stringify(label)}) + :is(input, textarea)`)
}

/**
 * The smallest element holding every text and the given button: one row in a
 * list where every row has the same buttons (a player's payment, a match).
 */
export function rowWith({
  scope,
  texts,
  button,
}: {
  scope: Scope
  texts: string[]
  button: string
}): Locator {
  const rows = texts.reduce(
    (found, text) => found.filter({ has: scope.getByText(text, { exact: true }) }),
    scope.locator('div'),
  )
  return rows.filter({ has: scope.getByRole('button', { name: button, exact: true }) }).last()
}
