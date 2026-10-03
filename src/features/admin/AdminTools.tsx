import React, { useMemo, useState } from 'react'
import { useApp } from '../../context/useApp'
import { useTournaments } from '../events/useTournaments'
import { usePlayers } from '../players/usePlayers'
import { useAllRegistrations } from '../events/useRegistrations'
import { useAllMatches } from '../events/useMatches'
import { useMerchInterests } from '../merch/useMerch'
import { readMerchLastChecked } from '../merch/lastChecked'
import { SignInBanner } from '../../components/ui/AuthGate'
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
import type { EventNavigate } from '../events/eventHelpers'

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
  const { session } = useApp()
  const { data: tournaments = [] } = useTournaments()
  const { data: players = [] } = usePlayers()
  const { data: allRegs = [] } = useAllRegistrations()
  const { data: allMatches = [] } = useAllMatches()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const [showReviewBreakdown, setShowReviewBreakdown] = useState(false)
  const { data: interests = [] } = useMerchInterests()

  // ── Pending-action counts ───────────────────────────────────────────────────
  const pendingSignups = useMemo(
    () => players.filter((p) => p.status === 'pending').length,
    [players],
  )

  const unpaidForNextEvent = useMemo(() => {
    const next = tournaments
      .filter((t) => t.status === 'upcoming' || t.status === 'active')
      .sort((a, b) => ((a.date || '') < (b.date || '') ? -1 : 1))[0]
    if (!next) return 0
    return allRegs.filter(
      (r) =>
        r.tournamentId === next.id &&
        r.status === 'registered' &&
        r.paymentStatus !== 'paid' &&
        r.paymentStatus !== 'transferred',
    ).length
  }, [tournaments, allRegs])

  // Counted off the merch slice's cached rows. The previous head:true count
  // query returned no rows, so reading `data.length` always yielded 0 and the
  // badge never appeared.
  const newOrdersCount = useMemo(() => {
    if (!isAdmin) return 0
    const lastChecked = readMerchLastChecked()
    return interests.filter((o) => (o.created_at || '') >= lastChecked).length
  }, [isAdmin, interests])

  const totalPending = pendingSignups + unpaidForNextEvent + newOrdersCount

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
      const r = corpReview(p, allMatches, allRegs, tournaments)
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
  }, [activePlayers, allMatches, allRegs, tournaments])

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

  if (!isAdmin) {
    return (
      <div className="-mx-4">
        <PageHeader title="Admin" />
        <div className="px-4 pt-4 space-y-3">
          <SignInBanner
            role="admin"
            onNavigate={onNavigate}
            message={undefined}
            compact={undefined}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="-mx-4">
      <PageHeader title="Admin" />
      <div className="px-4 pt-4 space-y-4">
        {/* Needs Attention */}
        {totalPending > 0 && (
          <div className="card space-y-2 border-l-4 border-lob-amber">
            <p className="text-xs font-bold text-lob-muted uppercase tracking-wide flex items-center gap-1.5">
              <AlertCircle size={13} className="text-lob-amber" /> Needs attention
            </p>
            {unpaidForNextEvent > 0 && (
              <button
                onClick={() => onNavigate?.('merch-orders')}
                className="w-full flex items-center justify-between text-sm text-lob-slate hover:text-lob-teal"
              >
                <span>
                  {unpaidForNextEvent} unpaid registration{unpaidForNextEvent !== 1 ? 's' : ''} for
                  next event
                </span>
                <ChevronRight size={14} className="text-lob-muted-light" />
              </button>
            )}
            {pendingSignups > 0 && (
              <button
                onClick={() => onNavigate?.('players')}
                className="w-full flex items-center justify-between text-sm text-lob-slate hover:text-lob-teal"
              >
                <span>
                  {pendingSignups} player signup{pendingSignups !== 1 ? 's' : ''} awaiting approval
                </span>
                <ChevronRight size={14} className="text-lob-muted-light" />
              </button>
            )}
            {newOrdersCount > 0 && (
              <button
                onClick={() => onNavigate?.('merch-orders')}
                className="w-full flex items-center justify-between text-sm text-lob-slate hover:text-lob-teal"
              >
                <span>
                  {newOrdersCount} new merch order{newOrdersCount !== 1 ? 's' : ''}
                </span>
                <ChevronRight size={14} className="text-lob-muted-light" />
              </button>
            )}
          </div>
        )}

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
