import { useEffect, useState } from 'react'

export default function usePersistentBoolean(key: string, defaultValue: boolean) {
  const [value, setValue] = useState<boolean>(() => {
    try {
      return localStorage.getItem(key) === '1'
    } catch {
      return defaultValue
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, value ? '1' : '0')
    } catch {
      // Ignore localStorage errors (private mode, unavailable API).
    }
  }, [key, value])

  return [value, setValue] as const
}
