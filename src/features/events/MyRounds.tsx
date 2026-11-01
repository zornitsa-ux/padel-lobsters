import { Check, MapPin, Coffee } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { ListCard, ListRow } from '../../components/ui/ListCard'
import { Section } from '../../components/ui/Section'
import { matchOutcome, type MyMatchView, type MyRoundView } from './nextMatch'
import type { Player } from '../../lib/normalise'

type GetPlayer = (id: string | null) => Player | undefined

const firstName = (player: Player | undefined, fallback: string): string =>
  player ? (player.name || fallback).split(' ')[0] : fallback

/**
 * The player's whole event: the next match as the one elevated card under "Up next", then every
 * other round in order as one list.
 */
export default function MyRounds({
  rounds,
  currentRound,
  getPlayer,
}: {
  rounds: MyRoundView[]
  currentRound: number | null
  getPlayer: GetPlayer
}) {
  const nextRound = rounds.find((r) => r.status === 'next' && r.match)
  const others = rounds.filter((r) => r !== nextRound)
  const lastPlayedRound = [...rounds].reverse().find((r) => r.match)?.round ?? null

  return (
    <>
      {nextRound?.match && (
        <Section title="Up next">
          <NextRoundCard view={nextRound.match} getPlayer={getPlayer} />
        </Section>
      )}
      {others.length > 0 && (
        <Section title="Your rounds">
          <ListCard>
            {others.map((round) => (
              <ListRow key={round.round}>
                {round.match ? (
                  <PlayedRound round={round} getPlayer={getPlayer} />
                ) : (
                  <SittingOut
                    round={round}
                    isCurrent={round.round === currentRound}
                    hasLaterMatch={lastPlayedRound != null && lastPlayedRound > round.round}
                  />
                )}
              </ListRow>
            ))}
          </ListCard>
        </Section>
      )}
    </>
  )
}

// ── Next match hero ──────────────────────────────────────────────────────────

function NextRoundCard({ view, getPlayer }: { view: MyMatchView; getPlayer: GetPlayer }) {
  const partner = getPlayer(view.partnerId)
  const opponents = view.opponentIds.map((id) => getPlayer(id))

  return (
    <div className="card-elevated space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-lob-teal bg-lob-cream px-2.5 py-1 rounded-full">
          Round {view.round}
        </span>
        {view.court && (
          <span className="flex items-center gap-1 text-sm font-bold text-lob-dark">
            <MapPin size={14} className="text-lob-coral" />
            Court {view.court}
          </span>
        )}
      </div>

      <div className="flex items-center justify-center gap-2">
        <Avatar player={partner ?? { name: '?' }} size="lg" />
        <div className="text-left">
          <p className="text-xs text-lob-muted-light">with</p>
          <p className="font-bold text-lob-dark">{firstName(partner, 'Partner TBD')}</p>
        </div>
      </div>

      <div className="text-center">
        <p className="text-xs font-semibold text-lob-muted-light uppercase tracking-wide">vs</p>
        <div className="flex items-center justify-center gap-3 mt-1">
          {opponents.map((opp, i) => (
            <div key={view.opponentIds[i] ?? i} className="flex items-center gap-1.5">
              <Avatar player={opp ?? { name: '?' }} size="sm" />
              <span className="text-sm font-medium text-lob-slate">{firstName(opp, 'TBD')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Played rounds (scored + still to come) ───────────────────────────────────

function OutcomeBadge({ view }: { view: MyMatchView }) {
  const outcome = matchOutcome(view)
  if (!outcome) return null

  const tone = ({ win: 'success', loss: 'danger', tie: 'outline' } as const)[outcome]
  const label = { win: 'Won', loss: 'Lost', tie: 'Tied' }[outcome]

  return <Badge tone={tone} label={label} />
}

function PlayedRound({ round, getPlayer }: { round: MyRoundView; getPlayer: GetPlayer }) {
  const view = round.match as MyMatchView
  const done = round.status === 'complete'
  const partner = getPlayer(view.partnerId)
  const opponents = view.opponentIds.map((id) => getPlayer(id))

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p
          className={`text-xs font-semibold flex items-center gap-1 ${
            done ? 'text-lob-muted' : 'text-lob-slate'
          }`}
        >
          {done && <Check size={12} className="text-lob-teal flex-shrink-0" />}
          Round {view.round}
          {view.court ? ` · Court ${view.court}` : ''}
        </p>
        <p className={`text-sm truncate ${done ? 'text-lob-muted' : 'text-lob-slate'}`}>
          with <span className="font-medium">{firstName(partner, 'Partner TBD')}</span> vs{' '}
          {opponents.map((o) => firstName(o, 'TBD')).join(' & ')}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {done ? (
          <>
            <span className="text-sm font-bold text-lob-slate">
              {view.myScore}–{view.opponentScore}
            </span>
            <OutcomeBadge view={view} />
          </>
        ) : (
          <span className="text-xs text-lob-muted-light">Later</span>
        )}
      </div>
    </div>
  )
}

// ── Rounds the player sits out ───────────────────────────────────────────────

function SittingOut({
  round,
  isCurrent,
  hasLaterMatch,
}: {
  round: MyRoundView
  isCurrent: boolean
  hasLaterMatch: boolean
}) {
  const highlight = isCurrent && round.status !== 'complete'

  return (
    <div className="flex items-center gap-2">
      <Coffee size={14} className={highlight ? 'text-lob-amber' : 'text-lob-muted-light'} />
      <p className={`text-sm ${highlight ? 'text-lob-slate font-semibold' : 'text-lob-muted'}`}>
        Round {round.round} · Sitting out
      </p>
      {highlight && (
        <p className="text-xs text-lob-muted ml-auto">
          {hasLaterMatch ? "You're back soon" : 'Done playing'}
        </p>
      )}
    </div>
  )
}
