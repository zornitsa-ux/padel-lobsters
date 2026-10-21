export type StorageArea = 'local' | 'session'

const areaOf = ({ area }: { area: StorageArea }): Storage =>
  area === 'local' ? window.localStorage : window.sessionStorage

export function readStorage({ area, key }: { area: StorageArea; key: string }): string | null {
  try {
    return areaOf({ area }).getItem(key)
  } catch {
    return null
  }
}

export function writeStorage({
  area,
  key,
  value,
}: {
  area: StorageArea
  key: string
  value: string
}): void {
  try {
    areaOf({ area }).setItem(key, value)
  } catch {
    /* storage unavailable */
  }
}

export function removeStorage({ area, key }: { area: StorageArea; key: string }): void {
  try {
    areaOf({ area }).removeItem(key)
  } catch {
    /* storage unavailable */
  }
}
