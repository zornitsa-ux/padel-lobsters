const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? 'http://127.0.0.1:54324'

interface MailpitMessage {
  ID: string
  Created: string
}

async function json<T>(path: string): Promise<T> {
  const res = await fetch(`${MAILPIT_URL}${path}`)
  if (!res.ok) throw new Error(`Mailpit ${path} responded ${res.status}`)
  return (await res.json()) as T
}

async function newestMessage({ to }: { to: string }): Promise<MailpitMessage | null> {
  const { messages } = await json<{ messages: MailpitMessage[] }>(
    `/api/v1/search?query=${encodeURIComponent(`to:${to}`)}&limit=1`,
  )
  return messages[0] ?? null
}

interface MailpitBody {
  Text: string
  HTML: string
}

// Polls for a message to `to` that arrived after `since` (ms).
async function waitForMessage({ to, since }: { to: string; since: number }): Promise<MailpitBody> {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const newest = await newestMessage({ to })
    if (newest && new Date(newest.Created).getTime() >= since) {
      return json<MailpitBody>(`/api/v1/message/${newest.ID}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`No email arrived for ${to}`)
}

export async function waitForCode({ to, since }: { to: string; since: number }): Promise<string> {
  const { Text } = await waitForMessage({ to, since })
  const code = /\b(\d{6})\b/.exec(Text)?.[1]
  if (!code) throw new Error(`The email to ${to} has no 6-digit code`)
  return code
}

// The email's /auth/confirm link as a path, so the test can open it on its own base URL.
export async function waitForConfirmPath({
  to,
  since,
}: {
  to: string
  since: number
}): Promise<string> {
  const { HTML } = await waitForMessage({ to, since })
  const href = /href="([^"]*\/auth\/confirm\?[^"]*)"/.exec(HTML)?.[1]
  if (!href) throw new Error(`The email to ${to} has no /auth/confirm link`)
  const url = new URL(href.replace(/&amp;/g, '&'))
  return url.pathname + url.search
}

export async function clearInbox({ to }: { to: string }): Promise<void> {
  const { messages } = await json<{ messages: MailpitMessage[] }>(
    `/api/v1/search?query=${encodeURIComponent(`to:${to}`)}&limit=50`,
  )
  if (messages.length === 0) return
  await fetch(`${MAILPIT_URL}/api/v1/messages`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ IDs: messages.map((m) => m.ID) }),
  })
}
