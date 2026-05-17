import React, { useState, useMemo } from 'react'
import { Check, GitMerge, X } from 'lucide-react'
import { TOURNAMENTS } from '../../data/historicalTournaments'
import { loadAliases, loadSkipped, saveAliases, saveSkipped } from './aliasStorage'
import { normalize } from './fuzzyMatch'
import { buildSimilarGroups } from './aliasClustering'
import { getAllHardcodedNames } from './historicalStats'

// ── Smart Match wizard ────────────────────────────────────────────────────────
export default function SmartMatchPanel({ onClose }) {
  const allNames = useMemo(getAllHardcodedNames, [])
  const [aliases, setAliasesState] = useState(loadAliases)
  const [skipped, setSkippedState] = useState(loadSkipped)
  const [step, setStep] = useState(0)
  const [checked, setChecked] = useState(null) // Set of checked names for current group
  const [input, setInput] = useState('')

  const groups = useMemo(
    () => buildSimilarGroups(allNames, aliases, skipped),
    [allNames, aliases, skipped],
  )

  const current = groups[step]

  // Initialise checkboxes when group changes — all checked by default
  const checkedSet = checked ?? new Set(current || [])

  const toggleCheck = (name) => {
    const next = new Set(checkedSet)
    next.has(name) ? next.delete(name) : next.add(name)
    setChecked(next)
  }

  // Which tournaments does a name appear in?
  const tournamentOf = (name) => {
    const norm = normalize(name)
    return TOURNAMENTS.filter(
      (t) =>
        t.players?.some((p) => normalize(p.name) === norm) ||
        t.rounds?.some((r) =>
          r.matches?.some(
            (m) =>
              m.t1?.some((n) => normalize(n) === norm) || m.t2?.some((n) => normalize(n) === norm),
          ),
        ),
    ).map((t) => t.name.replace('Lobster Tournament · ', ''))
  }

  const advance = (newAliases, newSkipped) => {
    saveAliases(newAliases)
    saveSkipped(newSkipped)
    setAliasesState(newAliases)
    setSkippedState(newSkipped)
    setChecked(null)
    setInput('')
    setStep((s) => s + 1)
  }

  const handleConfirm = () => {
    const toMerge = [...checkedSet]
    const toSkip = current.filter((n) => !checkedSet.has(n))
    const newAliases = { ...aliases }

    if (toMerge.length >= 2) {
      // Use input or first checked name as canonical
      const canonical = input.trim() || toMerge[0]
      toMerge.forEach((n) => {
        if (n !== canonical) newAliases[n] = canonical
      })
    }

    // Skip pairs between the two groups (merged vs unmerged) so they never re-appear
    const newPairs = []
    toMerge.forEach((a) => toSkip.forEach((b) => newPairs.push([a, b])))
    // Also skip pairs within unchecked names (they were shown and dismissed)
    for (let i = 0; i < toSkip.length; i++)
      for (let j = i + 1; j < toSkip.length; j++) newPairs.push([toSkip[i], toSkip[j]])

    advance(newAliases, [...skipped, ...newPairs])
  }

  const handleSkipAll = () => {
    // Mark every pair in this whole group as skipped
    const newPairs = []
    for (let i = 0; i < current.length; i++)
      for (let j = i + 1; j < current.length; j++) newPairs.push([current[i], current[j]])
    advance(aliases, [...skipped, ...newPairs])
  }

  const resetAll = () => {
    saveAliases({})
    saveSkipped([])
    setAliasesState({})
    setSkippedState([])
    setChecked(null)
    setStep(0)
  }

  const mergedCount = Object.keys(aliases).length

  if (!current) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
        <div className="bg-white rounded-t-3xl w-full max-w-md p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-800">Player Matching</h2>
            <button onClick={onClose}>
              <X size={20} className="text-gray-400" />
            </button>
          </div>
          <div className="text-center py-6 space-y-3">
            <div className="text-5xl">✅</div>
            <p className="font-bold text-gray-700">All done!</p>
            <p className="text-sm text-gray-400">
              {mergedCount > 0
                ? `${mergedCount} name${mergedCount !== 1 ? 's' : ''} merged across history.`
                : 'No similar names found to merge.'}
            </p>
          </div>
          <button onClick={resetAll} className="w-full text-xs text-gray-400 underline text-center">
            Reset all merges and start over
          </button>
          <button onClick={onClose} className="btn-primary w-full">
            Close
          </button>
        </div>
      </div>
    )
  }

  const progress = step / (step + groups.length)
  const checkedCount = checkedSet.size

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl w-full max-w-md flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold text-gray-800 flex items-center gap-2">
                <GitMerge size={18} className="text-lobster-teal" /> Match Players
              </h2>
              <p className="text-xs text-gray-400">Tick the names that belong to the same person</p>
            </div>
            <button onClick={onClose}>
              <X size={20} className="text-gray-400" />
            </button>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-lobster-teal rounded-full transition-all duration-500"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1 text-right">
            {step} reviewed · {groups.length} remaining
          </p>
        </div>

        {/* Name checklist */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {current.map((name) => {
            const tours = tournamentOf(name)
            const on = checkedSet.has(name)
            return (
              <button
                key={name}
                onClick={() => toggleCheck(name)}
                className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 transition-all text-left ${
                  on
                    ? 'bg-teal-50 border-2 border-lobster-teal'
                    : 'bg-gray-50 border-2 border-transparent'
                }`}
              >
                {/* Checkbox */}
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    on ? 'bg-lobster-teal border-lobster-teal' : 'border-gray-300'
                  }`}
                >
                  {on && <Check size={11} className="text-white" strokeWidth={3} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-sm ${on ? 'text-lobster-teal' : 'text-gray-800'}`}>
                    {name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {tours.length > 0 ? tours.join(' · ') : 'not in standings'}
                  </p>
                </div>
                <span className="text-lg shrink-0">
                  {tours.length >= 3 ? '🔥' : tours.length === 2 ? '⚡' : '🆕'}
                </span>
              </button>
            )
          })}

          {/* Canonical name input — only shown when ≥2 checked */}
          {checkedCount >= 2 && (
            <div className="pt-2 space-y-1.5">
              <p className="text-xs text-gray-500 font-semibold">
                Canonical name to use everywhere:
              </p>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={[...checkedSet][0]}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:border-lobster-teal"
              />
              <p className="text-[10px] text-gray-400">
                Leave blank to keep "{[...checkedSet][0]}"
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-gray-100 space-y-2">
          <button
            onClick={handleConfirm}
            disabled={checkedCount < 2}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Check size={16} />
            {checkedCount >= 2
              ? `Merge ${checkedCount} selected names`
              : 'Select at least 2 names to merge'}
          </button>
          <button
            onClick={handleSkipAll}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 active:scale-95 transition-all"
          >
            None are the same — skip all
          </button>
        </div>
      </div>
    </div>
  )
}
