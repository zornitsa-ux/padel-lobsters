import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/useApp'
import { isPublicPath } from '../../lib/authPaths'

export interface SignInDeepLink {
  requested: boolean
  email: string
}

export function parseSignInDeepLink({ search }: { search: string }): SignInDeepLink {
  const params = new URLSearchParams(search)
  const email = (params.get('email') ?? '').trim().toLowerCase()
  return { requested: params.has('signin'), email: email.includes('@') ? email : '' }
}

function withoutDeepLinkParams({ search }: { search: string }): string {
  const params = new URLSearchParams(search)
  params.delete('signin')
  params.delete('email')
  const rest = params.toString()
  return rest ? `?${rest}` : ''
}

// Opens the sign-in modal for `?signin=1[&email=]` when signed out on a public path.
// A protected path shows VerificationGate instead, which reads the same params.
export function useSignInDeepLink() {
  const { session, sessionSettled } = useApp()
  const { pathname, search, hash } = useLocation()
  const navigate = useNavigate()
  const [modal, setModal] = useState<SignInDeepLink | null>(null)
  const link = parseSignInDeepLink({ search })
  const settled = sessionSettled && link.requested
  const modalPath = settled && !session && isPublicPath(pathname)

  useEffect(() => {
    if (!settled || (!session && !modalPath)) return
    if (modalPath) setModal({ requested: true, email: link.email })
    navigate({ pathname, search: withoutDeepLinkParams({ search }), hash }, { replace: true })
  }, [settled, session, modalPath, link.email, pathname, search, hash, navigate])

  useEffect(() => {
    if (session) setModal(null)
  }, [session])

  const close = useCallback(() => setModal(null), [])
  return { open: modal !== null && !session, initialEmail: modal?.email ?? '', close }
}
