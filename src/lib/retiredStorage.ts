// Keys earlier builds wrote that nothing reads any more. Cleared at start so a
// returning browser doesn't keep them (the device ID keyed the PIN-era caps).
const RETIRED_KEYS = ['lobster_device_id']

export function clearRetiredStorage({ storage }: { storage: Pick<Storage, 'removeItem'> }) {
  try {
    RETIRED_KEYS.forEach((key) => storage.removeItem(key))
  } catch {
    // Storage unavailable (some private modes): nothing was kept either.
  }
}
