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

// Polls for a message that arrived after `since` (ms) and returns its 6-digit code.
export async function waitForCode({ to, since }: { to: string; since: number }): Promise<string> {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const newest = await newestMessage({ to })
    if (newest && new Date(newest.Created).getTime() >= since) {
      const msg = await json<{ Text: string }>(`/api/v1/message/${newest.ID}`)
      const code = /\b(\d{6})\b/.exec(msg.Text)?.[1]
      if (code) return code
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`No sign-in code arrived for ${to}`)
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
