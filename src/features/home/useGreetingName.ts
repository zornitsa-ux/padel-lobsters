import { useEffect, useState } from 'react'

// The home greeting needs the signed-in player's name, which only arrives with
// the full roster (usePlayers). That request lands ~300ms after the session
// hydrates from localStorage, so the greeting used to paint a placeholder
// ("Admin", or "Lobster") and visibly swap — greetings.js hashes the first
// letter of the name, so the whole phrase changed too, not just the name.
//
// Caching the resolved name per player id lets the correct greeting paint on
// the first frame of every subsequent load. Name only — no PII.
const KEY = 'pl_greeting_name'

interface Args {
  playerId: string | null
  name: string | null | undefined
}

interface Cache {
  id: string | null
  name: string | null
}

function read(playerId: string): string | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const { id, name } = JSON.parse(raw)
    return id === playerId && typeof name === 'string' ? name : null
  } catch {
    return null
  }
}

function write(playerId: string, name: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ id: playerId, name }))
  } catch {
    // Private-mode / quota — the greeting just falls back to the skeleton.
  }
}

/**
 * The name to greet, available on first paint when we've seen this player
 * before. Returns null when there is no cached name and none has loaded yet;
 * callers should render a placeholder rather than guess.
 */
export default function useGreetingName({ playerId, name }: Args): string | null {
  const [cache, setCache] = useState<Cache>({ id: null, name: null })

  // playerId arrives a render or two after mount (the session hydrates
  // asynchronously), so read on every change rather than only on the first
  // render — and drop the previous player's name when it changes.
  if (cache.id !== playerId) {
    setCache({ id: playerId, name: playerId ? read(playerId) : null })
  }

  useEffect(() => {
    if (!playerId || !name || name === cache.name) return
    write(playerId, name)
    setCache({ id: playerId, name })
  }, [playerId, name, cache.name])

  if (name) return name
  return cache.id === playerId ? cache.name : null
}
