import { useRef, useState } from 'react'
import DEFAULT_TIPS from '../../data/padelTips'

type Tips = string[] | null

const toTips = (saved?: Tips) => (saved && saved.length > 0 ? saved : null)

/**
 * Tip changes save straight away, one at a time, each building on the last. The saved list
 * takes over once nothing is pending, which is also what rolls back a failed write.
 */
export function useTipsEditor({
  saved,
  save,
  onError,
}: {
  saved?: Tips
  save: (tips: Tips) => Promise<unknown>
  onError: (err: unknown) => void
}) {
  const [draft, setDraft] = useState<Tips | undefined>(undefined)
  const latest = useRef<Tips>(null)
  const pending = useRef(0)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const tips = draft === undefined ? toTips(saved) : draft

  const settle = () => {
    pending.current -= 1
    if (pending.current === 0) setDraft(undefined)
  }

  const change = (compute: (current: string[]) => Tips) => {
    const base = pending.current > 0 ? latest.current : tips
    const next = compute(base ?? DEFAULT_TIPS)
    latest.current = next
    pending.current += 1
    setDraft(next)
    queue.current = queue.current
      .then(() => save(next))
      .catch(onError)
      .finally(settle)
  }

  return { tips, change }
}
