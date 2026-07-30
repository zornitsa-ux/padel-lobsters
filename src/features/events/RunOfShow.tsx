import type { NormalisedTournament } from '../../lib/normalise'

// Placeholder — the end-of-event sequence is built under workstream C.
export default function RunOfShow({
  tournament: _tournament,
}: {
  tournament: NormalisedTournament
}) {
  return <div data-testid="run-of-show" />
}
