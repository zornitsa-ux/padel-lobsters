import React, { useMemo, useState } from 'react'
import { useTournaments } from '../events/useTournaments'
import { usePlayers } from '../players/usePlayers'
import { useAllRegistrations } from '../events/useRegistrations'
import { useAllMatches } from '../events/useMatches'
import { useMerchInterests } from '../merch/useMerch'
import { readMerchLastChecked } from '../merch/lastChecked'
import ReviewBreakdownModal from '../community/ReviewBreakdownModal'
import type { ReviewBucket } from '../community/ReviewBreakdownModal'
import { REVIEW_SCENARIOS, corpReview } from '../community/reviewScenarios'
import type { LucideIcon } from 'lucide-react'
import {
  Users,
  Calculator,
  ShoppingBag,
  BarChart3,
  ChevronRight,
  AlertCircle,
  Info,
  Trophy,
} from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { LinkCard, LinkCardIcon } from '../../components/ui/LinkCard'
import { OptionRow } from '../../components/ui/OptionRow'
import { plural } from '../../lib/plural'
import AuthReadinessPanel from './AuthReadinessPanel'
import type { EventNavigate } from '../events/eventHelpers'
import { isEventUpcoming } from '../events/eventPhase'
import { useTeamResultsByEvent } from '../events/kingOfCourt/useTeamResultsByEvent'
import { owesPayment } from '../events/paymentStatus'

type AdminToolsProps = {
  onNavigate?: EventNavigate
}

type ToolCard = {
  id: string
  title: string
  description: string
  icon: LucideIcon
} & ({ to: string } | { onClick: () => void })

export default function AdminTools({ onNavigate }: AdminToolsProps) {
  const { data: tournaments = [] } = useTournaments()
  const { data: players = [] } = usePlayers()
  const { data: allRegs = [] } = useAllRegistrations()
  const { byEvent: teamResults } = useTeamResultsByEvent({
    tournaments,
    registrations: allRegs,
  })
  const { data: allMatches = [] } = useAllMatches()
  const [showReviewBreakdown, setShowReviewBreakdown] = useState(false)
  const { data: interests = [] } = useMerchInterests()

  // ── Pending-action counts ───────────────────────────────────────────────────
  const pendingSignups = useMemo(
    () => players.filter((p) => p.status === 'pending').length,
    [players],
  )

  const unpaidForNextEvent = useMemo(() => {
    const next = tournaments
      .filter((t) => isEventUpcoming({ tournament: t }))
      .sort((a, b) => ((a.date || '') < (b.date || '') ? -1 : 1))[0]
    if (!next) return 0
    return allRegs.filter(
      (r) =>
        r.tournamentId === next.id && r.status === 'registered' && owesPayment(r.paymentStatus),
    ).length
  }, [tournaments, allRegs])

  // Counted off the merch slice's cached rows. The previous head:true count
  // query returned no rows, so reading `data.length` always yielded 0 and the
  // badge never appeared.
  const newOrdersCount = useMemo(() => {
    const lastChecked = readMerchLastChecked()
    return interests.filter((o) => (o.created_at || '') >= lastChecked).length
  }, [interests])

  const attention = [
    {
      id: 'unpaid',
      count: unpaidForNextEvent,
      title: `${plural({ count: unpaidForNextEvent, one: 'unpaid registration' })} for next event`,
      target: 'merch-orders',
    },
    {
      id: 'signups',
      count: pendingSignups,
      title: `${plural({ count: pendingSignups, one: 'player signup' })} awaiting approval`,
      target: 'players',
    },
    {
      id: 'orders',
      count: newOrdersCount,
      title: plural({ count: newOrdersCount, one: 'new merch order' }),
      target: 'merch-orders',
    },
  ].filter((item) => item.count > 0)

  const activePlayers = useMemo(
    () => players.filter((p) => (p.status || 'active') === 'active'),
    [players],
  )

  const reviewBreakdown = useMemo(() => {
    const byScenario = new Map<string, ReviewBucket>()
    REVIEW_SCENARIOS.forEach((s) => {
      byScenario.set(s.id, { id: s.id, label: s.label, players: [], samples: new Map() })
    })
    activePlayers.forEach((p) => {
      const r = corpReview({
        player: p,
        matches: allMatches,
        registrations: allRegs,
        tournaments,
        teamResults,
      })
      let bucket = byScenario.get(r.scenario)
      if (!bucket) {
        bucket = { id: r.scenario, label: r.scenarioLabel, players: [], samples: new Map() }
        byScenario.set(r.scenario, bucket)
      }
      bucket.players.push({ id: p.id, name: p.name })
      const v = bucket.samples.get(r.text)
      if (v) v.count++
      else bucket.samples.set(r.text, { text: r.text, count: 1 })
    })
    return [...byScenario.values()]
      .filter((b) => b.players.length > 0)
      .sort((a, b) => b.players.length - a.players.length)
  }, [activePlayers, allMatches, allRegs, tournaments, teamResults])

  const GENERIC_IDS = new Set(['level-low', 'level-mid', 'level-high', 'level-elite', 'welcome'])
  const genericCount = reviewBreakdown
    .filter((b) => GENERIC_IDS.has(b.id))
    .reduce((n, b) => n + b.players.length, 0)
  const personalisedCount = activePlayers.length - genericCount

  const tools = useMemo<ToolCard[]>(
    () => [
      {
        id: 'review-breakdown',
        title: 'Lobster Review Breakdown',
        description: `${personalisedCount} personalised vs ${genericCount} generic reviews. Inspect scenarios and message variants.`,
        icon: BarChart3,
        onClick: () => setShowReviewBreakdown(true),
      },
      {
        id: 'approvals',
        title: 'Player Approvals',
        description:
          'Review pending signups, approve/reject requests, or link them to an existing player.',
        icon: Users,
        to: '/community',
      },
      {
        id: 'ratings',
        title: 'Ratings & Admin Settings',
        description: 'Manage admin settings and run rating recompute from a single place.',
        icon: Calculator,
        to: '/account',
      },
      {
        id: 'merch',
        title: 'Merch Admin',
        description: 'Manage shop items, order tracking, and tournament prizes.',
        icon: ShoppingBag,
        to: '/community/shop',
      },
      {
        id: 'lobster-way',
        title: 'The Lobster Way',
        description: 'Add, edit, reorder, or remove FAQ categories and questions.',
        icon: Info,
        to: '/admin/lobster-way',
      },
      {
        id: 'league',
        title: 'League',
        description:
          'Teams, scores, brackets and seasons are managed from the Manage button on each league.',
        icon: Trophy,
        to: '/league',
      },
    ],
    [personalisedCount, genericCount],
  )

  return (
    <div className="-mx-4">
      <PageHeader title="Admin" />
      <div className="px-4 pt-4 space-y-4">
        {/* Needs Attention */}
        {attention.length > 0 && (
          <div className="card space-y-2 border-l-4 border-lob-amber">
            <p className="text-xs font-bold text-lob-muted uppercase tracking-wide flex items-center gap-1.5">
              <AlertCircle size={13} className="text-lob-amber" /> Needs attention
            </p>
            <div className="space-y-1">
              {attention.map(({ id, title, target }) => (
                <OptionRow
                  key={id}
                  onClick={() => onNavigate?.(target)}
                  title={title}
                  trailing={<ChevronRight size={16} className="text-lob-muted-light" />}
                />
              ))}
            </div>
          </div>
        )}

        <AuthReadinessPanel />

        <div className="space-y-2">
          {tools.map(({ id, title, description, icon: Icon, ...action }) => (
            <LinkCard
              key={id}
              {...action}
              leading={
                <LinkCardIcon>
                  <Icon size={16} />
                </LinkCardIcon>
              }
              title={title}
              subtitle={description}
            />
          ))}
        </div>

        {showReviewBreakdown && (
          <ReviewBreakdownModal
            reviewBreakdown={reviewBreakdown}
            onClose={() => setShowReviewBreakdown(false)}
          />
        )}
      </div>
    </div>
  )
}
