import { useEffect, useRef } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { useApp } from '../../context/useApp'
import { funnelPageView } from './funnelPageView'

/**
 * Vercel Web Analytics for the signed-out funnel only (G5b). Mounted once auth has settled, so the
 * first page view already knows whether someone is signed in. The script reads `beforeSend` once,
 * so it checks the session through a ref.
 */
export default function GuestAnalytics() {
  const { session } = useApp()
  const signedIn = useRef(Boolean(session))
  useEffect(() => {
    signedIn.current = Boolean(session)
  }, [session])
  return (
    <Analytics
      mode="production"
      beforeSend={(event) => {
        const url = funnelPageView({ url: event.url, signedIn: signedIn.current })
        return url ? { ...event, url } : null
      }}
    />
  )
}
