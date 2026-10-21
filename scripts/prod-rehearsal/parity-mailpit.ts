export interface MailCredential {
  tokenHash: string
  type: string
}

// The magic_link template is link-only: the app redeems token_hash + type from the link.
export function extractCredential({ body }: { body: string }): MailCredential | null {
  const text = body.replaceAll('&amp;', '&')
  const tokenHash = /token_hash=([A-Za-z0-9_-]+)/.exec(text)?.[1]
  if (!tokenHash) return null
  return { tokenHash, type: /[?&]type=([a-z_]+)/.exec(text)?.[1] ?? 'magiclink' }
}

async function request({ url, init }: { url: string; init?: RequestInit }) {
  const response = await fetch(url, init)
  if (!response.ok) throw new Error(`mailpit_http_${response.status}`)
  return response.json()
}

export async function messageIdsTo({ mailpitUrl, email }: { mailpitUrl: string; email: string }) {
  const query = encodeURIComponent(`to:"${email}"`)
  const result = await request({ url: `${mailpitUrl}/api/v1/search?query=${query}` })
  return (result.messages ?? []).map((message: { ID: string }) => message.ID) as string[]
}

export async function messageBody({ mailpitUrl, id }: { mailpitUrl: string; id: string }) {
  const message = await request({ url: `${mailpitUrl}/api/v1/message/${id}` })
  return `${message.Text ?? ''}\n${message.HTML ?? ''}`
}

export async function deleteMessages({ mailpitUrl, ids }: { mailpitUrl: string; ids: string[] }) {
  await fetch(`${mailpitUrl}/api/v1/messages`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ IDs: ids }),
  })
}

export async function waitForNewMessage({
  mailpitUrl,
  email,
  knownIds,
  timeoutMs = 20000,
}: {
  mailpitUrl: string
  email: string
  knownIds: string[]
  timeoutMs?: number
}): Promise<string | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const fresh = (await messageIdsTo({ mailpitUrl, email })).find((id) => !knownIds.includes(id))
    if (fresh) return fresh
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return null
}
