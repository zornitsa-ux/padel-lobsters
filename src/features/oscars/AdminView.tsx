import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Play, X, Share2, Loader2 } from 'lucide-react'
import { Shell, PhaseBanner } from './OscarsShell'
import { buildDefaultCategories } from './oscarCategories'
import CategoryEditor from './CategoryEditor'
import StatRow from './StatRow'
import ResultsView from './ResultsView'
import { AlertBox } from '../../components/ui/AlertBox'
import { EmptyState } from '../../components/ui/EmptyState'
import { ListCard, ListRow } from '../../components/ui/ListCard'
import { Section } from '../../components/ui/Section'
import type { EditableCategory } from './CategoryEditor'
import type { OscarsPhase } from './oscarsPhase'
import type {
  AdminStatRow,
  CategoryRow,
  CategoryVoterRow,
  ResultRow,
  SessionRow,
} from './oscarsSchemas'
import type { OscarCategoryInput } from './useOscarsSession'
import type { Player } from '../../lib/normalise'
import { Button } from '../../components/ui/Button'

interface AdminViewProps {
  phase: OscarsPhase
  session: SessionRow | null | undefined
  categories: CategoryRow[]
  regPlayers: Player[]
  adminStats: AdminStatRow[]
  adminResults: ResultRow[]
  categoryVoters: Record<string, CategoryVoterRow[]>
  busy: boolean
  error: string | null
  onDismissError: () => void
  onBack: () => void
  onStart: (cats: OscarCategoryInput[]) => void
  onEnd: () => void
  onShare: () => void
  loadCategoryVoters: (categoryId: string) => void
  headerRight?: ReactNode
}

/* ════════════════════════════════════════════════════════════════════════════
   AdminView — the admin control surface across phases (configure/start, live
   participation, results + share). Presentational: all data and mutations come
   in via props; the editable-category and expanded-row UI state is local.
   ════════════════════════════════════════════════════════════════════════════ */
export default function AdminView({
  phase,
  session,
  categories,
  regPlayers,
  adminStats,
  adminResults,
  categoryVoters,
  busy,
  error,
  onDismissError,
  onStart,
  onEnd,
  onShare,
  loadCategoryVoters,
  headerRight,
}: AdminViewProps) {
  // null = derive from the saved categories (or the defaults)
  const [editCats, setEditCats] = useState<EditableCategory[] | null>(null)
  const [expandedStatCatId, setExpandedStatCatId] = useState<string | null>(null)

  const baseCats = useMemo<EditableCategory[]>(() => {
    if (editCats) return editCats
    if (categories.length) {
      return categories.map((c) => ({
        name: c.name,
        icon: c.icon,
        display_order: c.display_order,
      }))
    }
    return buildDefaultCategories(regPlayers)
  }, [editCats, categories, regPlayers])

  // Load the expanded category's voter list once on expand. Re-expanding re-pulls it — no poll.
  useEffect(() => {
    if (!expandedStatCatId || phase !== 'active') return
    loadCategoryVoters(expandedStatCatId)
  }, [expandedStatCatId, phase, loadCategoryVoters])

  const handleStart = () => {
    const cats = baseCats.map((c, i) => ({
      name: c.name?.trim() || 'Untitled',
      icon: c.icon?.trim() || '🦞',
      display_order: typeof c.display_order === 'number' ? c.display_order : i,
    }))
    onStart(cats)
  }

  /* ── pre-start / not-created: configure + start ───────────────────────── */
  if (phase === 'not_created' || phase === 'pre_start') {
    return (
      <Shell
        title="🦞 Lobster Games"
        headerRight={headerRight}
        intro={
          <>
            <span className="font-semibold text-lob-dark">Async Lobster Oscars.</span> Once you
            start, players vote any time during the tournament. End voting when the tournament wraps
            up. Results stay private to you until you press <em>Share</em>.
          </>
        }
      >
        <div className="space-y-3">
          <Section title="Categories">
            <CategoryEditor
              cats={baseCats}
              onChange={setEditCats}
              onReset={() => setEditCats(buildDefaultCategories(regPlayers))}
            />
          </Section>

          {error && (
            <AlertBox variant="error" onDismiss={onDismissError}>
              {error}
            </AlertBox>
          )}

          <Button
            size="lg"
            fullWidth
            icon={busy ? <Loader2 className="animate-spin" /> : <Play />}
            onClick={handleStart}
            disabled={busy || baseCats.length === 0}
          >
            {busy ? 'Starting…' : 'Start Lobster Games'}
          </Button>
          <p className="text-xs text-lob-muted-light text-center -mt-1">
            Once started, categories can&apos;t be edited. You can end voting at any time.
          </p>
        </div>
      </Shell>
    )
  }

  /* ── active: live counts + end ────────────────────────────────────────── */
  if (phase === 'active') {
    return (
      <Shell title="🦞 Lobster Games" headerRight={headerRight}>
        <div className="space-y-3">
          <PhaseBanner status="active" startedAt={session?.started_at} />
          <Section
            title="Live participation"
            description="Updates when you open this screen or come back to it."
          >
            {adminStats.length === 0 ? (
              <EmptyState variant="inline" title="No participation data yet" />
            ) : (
              <ListCard>
                {adminStats.map((s) => (
                  <ListRow key={s.category_id}>
                    <StatRow
                      stat={s}
                      expanded={expandedStatCatId === s.category_id}
                      voters={categoryVoters[s.category_id]}
                      onToggle={() =>
                        setExpandedStatCatId((prev) =>
                          prev === s.category_id ? null : s.category_id,
                        )
                      }
                    />
                  </ListRow>
                ))}
              </ListCard>
            )}
          </Section>

          {error && (
            <AlertBox variant="error" onDismiss={onDismissError}>
              {error}
            </AlertBox>
          )}

          <Button
            size="lg"
            fullWidth
            icon={busy ? <Loader2 className="animate-spin" /> : <X />}
            onClick={onEnd}
            disabled={busy}
          >
            End game
          </Button>
        </div>
      </Shell>
    )
  }

  /* ── ended / shared: rankings + share ─────────────────────────────────── */
  return (
    <Shell title="🦞 Final Results" headerRight={headerRight}>
      <div className="space-y-3">
        <PhaseBanner
          status={phase}
          startedAt={session?.started_at}
          closedAt={session?.closed_at}
          sharedAt={session?.shared_at}
        />

        <ResultsView results={adminResults} collapsible />

        {error && (
          <AlertBox variant="error" onDismiss={onDismissError}>
            {error}
          </AlertBox>
        )}

        {phase === 'ended' && (
          <Button
            fullWidth
            icon={busy ? <Loader2 className="animate-spin" /> : <Share2 />}
            onClick={onShare}
            disabled={busy}
          >
            Share with players
          </Button>
        )}
      </div>
    </Shell>
  )
}
