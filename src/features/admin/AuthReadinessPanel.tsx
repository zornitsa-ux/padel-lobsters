import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { PIN_SUNSET_LABEL } from '../auth/pinSunset'
import { authReadinessKey, fetchAuthReadiness, type AuthReadiness } from './authReadiness'

const formatPinDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

function NameList({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-bold text-lob-muted uppercase tracking-wide">{title}</p>
      <ul className="text-sm text-lob-slate space-y-0.5">{children}</ul>
    </div>
  )
}

function ReadinessBody({ readiness }: { readiness: AuthReadiness }) {
  const { no_email, recent_pin_users, switched_count, still_pin_count } = readiness
  return (
    <>
      <p className="text-sm font-semibold text-lob-slate">
        Switched to email: {switched_count} · Still on PIN: {still_pin_count}
      </p>
      {no_email.length > 0 && (
        <NameList title="No real email — contact these players">
          {no_email.map((p) => (
            <li key={p.id}>{p.name}</li>
          ))}
        </NameList>
      )}
      {recent_pin_users.length > 0 && (
        <NameList title="Signed in with a PIN in the last 14 days">
          {recent_pin_users.map((p) => (
            <li key={p.id} className="flex justify-between gap-2">
              <span>{p.name}</span>
              <span className="text-lob-muted">{formatPinDate(p.last_pin_at)}</span>
            </li>
          ))}
        </NameList>
      )}
    </>
  )
}

export default function AuthReadinessPanel() {
  const { data, isLoading, isError } = useQuery({
    queryKey: authReadinessKey,
    queryFn: fetchAuthReadiness,
  })

  return (
    <div className="card space-y-3" data-testid="auth-readiness">
      <p className="text-xs font-bold text-lob-muted uppercase tracking-wide">
        Sign-in readiness · PINs stop working on {PIN_SUNSET_LABEL}
      </p>
      {isLoading && <p className="text-sm text-lob-muted">Loading…</p>}
      {isError && <p className="text-sm text-lob-danger">Could not load sign-in readiness.</p>}
      {data && <ReadinessBody readiness={data} />}
    </div>
  )
}
