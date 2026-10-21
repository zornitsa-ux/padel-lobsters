const FLAG_KEY = 'pl_pin_sign_in'
export const PIN_SIGN_IN_EVENT = 'pl:pin-sign-in'

export function markPinSignIn(): void {
  try {
    sessionStorage.setItem(FLAG_KEY, '1')
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(PIN_SIGN_IN_EVENT))
}

export function hasPinSignIn(): boolean {
  try {
    return sessionStorage.getItem(FLAG_KEY) === '1'
  } catch {
    return false
  }
}

export function clearPinSignIn(): void {
  try {
    sessionStorage.removeItem(FLAG_KEY)
  } catch {
    /* storage unavailable */
  }
}
