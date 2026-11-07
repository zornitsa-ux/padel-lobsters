import { useCallback, useRef } from 'react'
import { Analytics, type BeforeSendEvent } from '@vercel/analytics/react'
import { useApp } from '../../context/useApp'
import { funnelPageView } from './funnelPageView'

/**
 * Vercel Web Analytics for the signed-out funnel only (G5b). The auth state is read through a
 * ref set during render, so a page view right after signing in is already filtered, and the
 * callback stays stable.
 */
export default function GuestAnalytics() {
  const { session } = useApp()
  const signedIn = useRef(Boolean(session))
  signedIn.current = Boolean(session)
  const beforeSend = useCallback((event: BeforeSendEvent) => {
    const url = funnelPageView({ url: event.url, signedIn: signedIn.current })
    return url ? { ...event, url } : null
  }, [])
  return <Analytics beforeSend={beforeSend} />
}
