import React, { useMemo, useState } from 'react'
import { useApp } from '../../context/useApp'
import { useTournaments } from '../events/useTournaments'
import { usePlayers } from '../players/usePlayers'
import { useAllRegistrations } from '../events/useRegistrations'
import { useAllMatches } from '../events/useMatches'
import usePlayerAliases from '../../hooks/usePlayerAliases'
import { useMerchInterests } from '../merch/useMerch'
import { SignInBanner } from '../../components/ui/AuthGate'
import PlayerAliasMatcher from '../../components/PlayerAliasMatcher'
import ReviewBreakdownModal from '../community/ReviewBreakdownModal'
import { REVIEW_SCENARIOS, corpReview } from '../community/reviewScenarios'
import {
  GitMerge,
  Users,
  Calculator,
  ShoppingBag,
  BarChart3,
  ChevronRight,
  AlertCircle,
} from 'lucide-react'
import LeagueAdminSection from '../league/LeagueAdminSection'
import { PageHeader } from '../../components/ui/PageHeader'
import type { EventNavigate } from '../events/eventHelpers'

type AdminToolsProps = {
  onNavigate?: EventNavigate
}

type ToolCard = {
  id: string
  title: string
  description: string
  actionLabel: string
  icon: React.ComponentType<any>
  onClick: () => void
}

const LAST_CHECK_KEY = 'pl_merch_last_checked'

export default function AdminTools({ onNavigate }: AdminToolsProps) {
  const { session } = useApp() as any
  const { data: tournaments = [] } = useTournaments()
  const { data: players = [] } = usePlayers()
  const { data: allRegs = [] } = useAllRegistrations()
  const { data: allMatches = [] } = useAllMatches()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const { playerAliases, setPlayerAlias, removePlayerAlias } = usePlayerAliases()
  const [showAliasMatcher, setShowAliasMatcher] = useState(false)
  const [showReviewBreakdown, setShowReviewBreakdown] = useState(false)
  const { data: interests = [] } = useMerchInterests()

  // ── Pending-action counts ───────────────────────────────────────────────────
  const pendingSignups = useMemo(
    () => (players as any[]).filter((p: any) => p.status === 'pending').length,
    [players],
  )

  const unpaidForNextEvent = useMemo(() => {
    const next = (tournaments as any[])
      .filter((t: any) => t.status === 'upcoming' || t.status === 'active')
      .sort((a: any, b: any) => ((a.date || '') < (b.date || '') ? -1 : 1))[0]
    if (!next) return 0
    return (allRegs as any[]).filter(
      (r: any) =>
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
    const lastChecked = localStorage.getItem(LAST_CHECK_KEY) || new Date(0).toISOString()
    return interests.filter((o) => (o.created_at || '') >= lastChecked).length
  }, [isAdmin, interests])

  const totalPending = pendingSignups + unpaidForNextEvent + newOrdersCount

  const activePlayers = useMemo(
    () => (players || []).filter((p: any) => (p?.status || 'active') === 'active'),
    [players],
  )

  const reviewBreakdown = useMemo(() => {
    const byScenario = new Map<string, any>()
    REVIEW_SCENARIOS.forEach((s: any) => {
      byScenario.set(s.id, { id: s.id, label: s.label, players: [], samples: new Map() })
    })
    activePlayers.forEach((p: any) => {
      const r = corpReview(p, allMatches, allRegs, tournaments, playerAliases)
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
  }, [activePlayers, allMatches, allRegs, tournaments, playerAliases])

  const GENERIC_IDS = new Set(['level-low', 'level-mid', 'level-high', 'level-elite', 'welcome'])
  const genericCount = reviewBreakdown
    .filter((b) => GENERIC_IDS.has(b.id))
    .reduce((n, b) => n + b.players.length, 0)
  const personalisedCount = activePlayers.length - genericCount

  const tools = useMemo<ToolCard[]>(
    () => [
      {
        id: 'match-history',
        title: 'Match History Matcher',
        description:
          'Map historical tournament names to current player profiles so stats and history are accurate.',
        icon: GitMerge,
        actionLabel: 'Open tool',
        onClick: () => setShowAliasMatcher(true),
      },
      {
        id: 'review-breakdown',
        title: 'Lobster Review Breakdown',
        description: `${personalisedCount} personalised vs ${genericCount} generic reviews. Inspect scenarios and message variants.`,
        icon: BarChart3,
        actionLabel: 'Open breakdown',
        onClick: () => setShowReviewBreakdown(true),
      },
      {
        id: 'approvals',
        title: 'Player Approvals',
        description:
          'Review pending signups, approve/reject requests, or link them to an existing player.',
        icon: Users,
        actionLabel: 'Go to Players',
        onClick: () => onNavigate?.('players'),
      },
      {
        id: 'ratings',
        title: 'Ratings & Admin Settings',
        description: 'Manage admin settings and run rating recompute from a single place.',
        icon: Calculator,
        actionLabel: 'Go to Account',
        onClick: () => onNavigate?.('settings'),
      },
      {
        id: 'merch',
        title: 'Merch Admin',
        description: 'Manage shop items, order tracking, and tournament prizes.',
        icon: ShoppingBag,
        actionLabel: 'Go to Shop',
        onClick: () => onNavigate?.('merch'),
      },
    ],
    [onNavigate, personalisedCount, genericCount],
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
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <AlertCircle size={13} className="text-lob-amber" /> Needs attention
            </p>
            {unpaidForNextEvent > 0 && (
              <button
                onClick={() => onNavigate?.('merch-orders')}
                className="w-full flex items-center justify-between text-sm text-gray-700 hover:text-lob-teal"
              >
                <span>
                  {unpaidForNextEvent} unpaid registration{unpaidForNextEvent !== 1 ? 's' : ''} for
                  next event
                </span>
                <ChevronRight size={14} className="text-gray-400" />
              </button>
            )}
            {pendingSignups > 0 && (
              <button
                onClick={() => onNavigate?.('players')}
                className="w-full flex items-center justify-between text-sm text-gray-700 hover:text-lob-teal"
              >
                <span>
                  {pendingSignups} player signup{pendingSignups !== 1 ? 's' : ''} awaiting approval
                </span>
                <ChevronRight size={14} className="text-gray-400" />
              </button>
            )}
            {newOrdersCount > 0 && (
              <button
                onClick={() => onNavigate?.('merch-orders')}
                className="w-full flex items-center justify-between text-sm text-gray-700 hover:text-lob-teal"
              >
                <span>
                  {newOrdersCount} new merch order{newOrdersCount !== 1 ? 's' : ''}
                </span>
                <ChevronRight size={14} className="text-gray-400" />
              </button>
            )}
          </div>
        )}

        <div className="space-y-2">
          {tools.map((tool) => {
            const Icon = tool.icon
            return (
              <div key={tool.id} className="card">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-lob-cream text-lob-teal flex items-center justify-center flex-shrink-0">
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{tool.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{tool.description}</p>
                    <button
                      onClick={tool.onClick}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-lob-teal hover:underline"
                    >
                      {tool.actionLabel} <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {showAliasMatcher && (
          <PlayerAliasMatcher
            players={players}
            playerAliases={playerAliases}
            setPlayerAlias={setPlayerAlias}
            removePlayerAlias={removePlayerAlias}
            onClose={() => setShowAliasMatcher(false)}
          />
        )}

        {showReviewBreakdown && (
          <ReviewBreakdownModal
            reviewBreakdown={reviewBreakdown}
            onClose={() => setShowReviewBreakdown(false)}
          />
        )}

        <div className="pt-2 border-t border-gray-100">
          <LeagueAdminSection />
        </div>
      </div>
    </div>
  )
}
