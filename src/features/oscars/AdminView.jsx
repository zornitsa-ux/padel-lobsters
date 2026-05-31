import React, { useEffect, useMemo, useState } from 'react'
import { Play, X, Share2, Loader2, Check } from 'lucide-react'
import { Shell, SectionLabel, PhaseBanner } from './OscarsShell'
import { buildDefaultCategories } from './oscarCategories'
import CategoryEditor from './CategoryEditor'
import StatRow from './StatRow'
import ResultsView from './ResultsView'
import ErrorBanner from './ErrorBanner'

/* ════════════════════════════════════════════════════════════════════════════
   AdminView — the admin control surface across phases (configure/start, live
   participation, results + share). Presentational: all data and mutations come
   in via props; the editable-category and expanded-row UI state is local.
   ════════════════════════════════════════════════════════════════════════════ */
export default function AdminView({
  phase,
  tournament,
  session,
  categories,
  regPlayers,
  adminStats,
  adminResults,
  categoryVoters,
  busy,
  error,
  onDismissError,
  onBack,
  onStart,
  onEnd,
  onShare,
  loadCategoryVoters,
  headerRight,
}) {
  const [editCats, setEditCats] = useState(null) // null = derive from saved/defaults
  const [expandedStatCatId, setExpandedStatCatId] = useState(null)

  const baseCats = useMemo(() => {
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

  // Refresh the expanded category's voter list (initial + every 10s while active)
  useEffect(() => {
    if (!expandedStatCatId || phase !== 'active') return
    loadCategoryVoters(expandedStatCatId)
    const t = setInterval(() => loadCategoryVoters(expandedStatCatId), 10000)
    return () => clearInterval(t)
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
        onBack={onBack}
        title="🦞 Lobster Games"
        subtitle={tournament?.name}
        headerRight={headerRight}
      >
        <div className="space-y-3">
          <div className="bg-white rounded-2xl p-4">
            <p className="text-sm text-gray-600 leading-snug">
              <span className="font-semibold text-gray-800">Async Lobster Oscars.</span> Once you
              start, players vote any time during the tournament. End voting when the tournament
              wraps up. Results stay private to you until you press <em>Share</em>.
            </p>
          </div>

          <SectionLabel>Categories</SectionLabel>
          <CategoryEditor
            cats={baseCats}
            onChange={setEditCats}
            onReset={() => setEditCats(buildDefaultCategories(regPlayers))}
          />

          {error && <ErrorBanner message={error} onDismiss={onDismissError} />}

          <button
            onClick={handleStart}
            disabled={busy || baseCats.length === 0}
            className="w-full bg-lobster-teal text-white font-bold py-4 rounded-2xl text-base flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 mt-4"
          >
            {busy ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
            {busy ? 'Starting…' : 'Start Lobster Games'}
          </button>
          <p className="text-[11px] text-gray-400 text-center -mt-1">
            Once started, categories can&apos;t be edited. You can end voting at any time.
          </p>
        </div>
      </Shell>
    )
  }

  /* ── active: live counts + end ────────────────────────────────────────── */
  if (phase === 'active') {
    return (
      <Shell
        onBack={onBack}
        title="🦞 Lobster Games"
        subtitle={tournament?.name}
        headerRight={headerRight}
      >
        <div className="space-y-3">
          <PhaseBanner status="active" startedAt={session.started_at} />
          <SectionLabel>Live participation</SectionLabel>
          {adminStats.length === 0 && (
            <div className="bg-white rounded-2xl p-4 text-center text-sm text-gray-400">
              No data yet — refreshing…
            </div>
          )}
          {adminStats.map((s) => (
            <StatRow
              key={s.category_id}
              stat={s}
              expanded={expandedStatCatId === s.category_id}
              voters={categoryVoters[s.category_id]}
              onToggle={() =>
                setExpandedStatCatId((prev) => (prev === s.category_id ? null : s.category_id))
              }
            />
          ))}
          <p className="text-[11px] text-gray-400 text-center pt-1">Refreshes every 10 seconds.</p>

          {error && <ErrorBanner message={error} onDismiss={onDismissError} />}

          <button
            onClick={onEnd}
            disabled={busy}
            className="w-full bg-lobster-orange text-white font-bold py-4 rounded-2xl text-base flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 mt-4"
          >
            {busy ? <Loader2 className="animate-spin" size={18} /> : <X size={18} />}
            End game
          </button>
        </div>
      </Shell>
    )
  }

  /* ── ended / shared: rankings + share ─────────────────────────────────── */
  return (
    <Shell
      onBack={onBack}
      title="🦞 Final Results"
      subtitle={tournament?.name}
      headerRight={headerRight}
    >
      <div className="space-y-3">
        <PhaseBanner
          status={phase}
          startedAt={session.started_at}
          closedAt={session.closed_at}
          sharedAt={session.shared_at}
        />

        <ResultsView results={adminResults} collapsible />

        {error && <ErrorBanner message={error} onDismiss={onDismissError} />}

        <div className="pt-2">
          {phase === 'ended' ? (
            <button
              onClick={onShare}
              disabled={busy}
              className="w-full bg-lobster-teal text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
              {busy ? <Loader2 className="animate-spin" size={16} /> : <Share2 size={16} />}
              Share with players
            </button>
          ) : (
            <div className="w-full bg-green-50 text-green-700 font-semibold py-3 rounded-xl text-sm flex items-center justify-center gap-2">
              <Check size={16} /> Shared with players
            </div>
          )}
        </div>
      </div>
    </Shell>
  )
}
