// D-029 — pure "results reveal" logic (no React, no Supabase). The final
// ranking/podium/winner is its own gate: for a preset that reveals standings
// (Americano), players see them only once `resultsSharedAt` is set, before and
// after the event alike (event-system EV-D5). A preset that shows standings on
// save (King of the Court, D-026) has no gate. Admins always see results.

import { revealsStandings } from './presets'

// Whether THIS viewer should have the final ranking/winner withheld.
export function resultsWithheld({
  tournament,
  isAdmin,
}: {
  tournament: { format?: string | null; resultsSharedAt: string | null }
  isAdmin: boolean
}): boolean {
  return !isAdmin && revealsStandings(tournament) && !tournament.resultsSharedAt
}
