import { readStorage, removeStorage, writeStorage } from '../../lib/safeStorage'

const FLAG_KEY = 'pl_pin_sign_in'
export const PIN_SIGN_IN_EVENT = 'pl:pin-sign-in'

export function markPinSignIn(): void {
  writeStorage({ area: 'session', key: FLAG_KEY, value: '1' })
  window.dispatchEvent(new Event(PIN_SIGN_IN_EVENT))
}

export function hasPinSignIn(): boolean {
  return readStorage({ area: 'session', key: FLAG_KEY }) === '1'
}

export function clearPinSignIn(): void {
  removeStorage({ area: 'session', key: FLAG_KEY })
}
