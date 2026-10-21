import { useCallback, useEffect, useState } from 'react'

export function formatCountdown({ seconds }: { seconds: number }): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function useCountdown({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState(seconds)

  useEffect(() => {
    if (remaining <= 0) return
    const timer = setTimeout(() => setRemaining((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [remaining])

  const restart = useCallback(({ seconds: next }: { seconds: number }) => setRemaining(next), [])
  return { remaining, restart }
}
