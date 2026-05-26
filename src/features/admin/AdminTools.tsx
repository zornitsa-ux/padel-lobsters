import React, { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import usePlayerAliases from '../../hooks/usePlayerAliases'
import { SignInBanner } from '../../components/ui/AuthGate'
import PlayerAliasMatcher from '../../components/PlayerAliasMatcher'
import ReviewBreakdownModal from '../community/ReviewBreakdownModal'
import { REVIEW_SCENARIOS, corpReview } from '../community/reviewScenarios'
import { GitMerge, Users, Calculator, ShoppingBag, BarChart3, ChevronRight, Trophy } from 'lucide-react'
import LeagueAdminSection from '../league/LeagueAdminSection'

type AdminToolsProps = {
  onNavigate?: (page: string, payload?: unknown) => void
}

type ToolCard = {
  id: string
  title: string
  description: string
  actionLabel: string
  icon: React.ComponentType<any>
  onClick: () => void
}

export default function AdminTools({ onNavigate }: AdminToolsProps) {
  const { session, players, matches, registrations, tournaments } = useApp() as any
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const { playerAliases, setPlayerAlias, removePlayerAlias } = usePlayerAliases()
  const [showAliasMatcher, setShowAliasMatcher] = useState(false)
  const [showReviewBreakdown, setShowReviewBreakdown] = useState(false)

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
      const r = corpReview(p, matches, registrations, tournaments, playerAliases)
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
  }, [activePlayers, matches, registrations, tournaments, playerAliases])

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
        actionLabel: 'Go to Settings',
        onClick: () => onNavigate?.('settings'),
      },
      {
        id: 'merch',
        title: 'Merch Admin',
        description: 'Manage shop items, order tracking, and tournament prizes.',
        icon: ShoppingBag,
        actionLabel: 'Go to Merch',
        onClick: () => onNavigate?.('merch'),
      },
    ],
    [onNavigate, personalisedCount, genericCount],
  )

  if (!isAdmin) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-gray-800">Admin</h2>
        <SignInBanner
          role="admin"
          onNavigate={onNavigate}
          message={undefined}
          compact={undefined}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-800">Admin Tools</h2>
        <p className="text-xs text-gray-500 mt-1">
          Quick access to admin-only workflows and utilities.
        </p>
      </div>

      <div className="space-y-2">
        {tools.map((tool) => {
          const Icon = tool.icon
          return (
            <div key={tool.id} className="card">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-lobster-cream text-lobster-teal flex items-center justify-center flex-shrink-0">
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{tool.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{tool.description}</p>
                  <button
                    onClick={tool.onClick}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-lobster-teal hover:underline"
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
  )
}
