// D-029 — pure "results reveal" phase logic (no React, no Supabase). Mirrors
// the shape of ../oscars/oscarsPhase.ts's ended/shared split: `completed`
// keeps meaning "scores locked + ratings computed"; `resultsSharedAt` is a
// second, independent gate on when non-admin players see the final
// ranking/podium/winner. Admins always see results regardless of phase.

export type ResultsPhase = 'not_completed' | 'pending_reveal' | 'revealed'

export function resultsPhase(tournament: {
  status: string
  resultsSharedAt: string | null
}): ResultsPhase {
  if (tournament.status !== 'completed') return 'not_completed'
  return tournament.resultsSharedAt ? 'revealed' : 'pending_reveal'
}

// Whether THIS viewer should have the final ranking/winner withheld.
export function resultsWithheld({
  tournament,
  isAdmin,
}: {
  tournament: { status: string; resultsSharedAt: string | null }
  isAdmin: boolean
}): boolean {
  return !isAdmin && resultsPhase(tournament) === 'pending_reveal'
}
