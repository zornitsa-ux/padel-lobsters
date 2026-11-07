/**
 * An in-app path from untrusted input (a query param, storage, router state),
 * or null. The browser's own URL parser (WHATWG URL, the one it navigates
 * with) resolves the input against this origin, and anything that lands on
 * another origin is rejected: `//host`, `/\host`, `javascript:`, `data:`, and
 * whitespace tricks the parser strips. No string matching of our own.
 */
export function safeAppPath({
  input,
  origin = window.location.origin,
}: {
  input: string | null | undefined
  origin?: string
}): string | null {
  if (!input) return null
  let url: URL
  try {
    url = new URL(input, origin)
  } catch {
    return null
  }
  return url.origin === origin ? url.pathname + url.search + url.hash : null
}
