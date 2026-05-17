import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { PhaseRangeField } from './RangeCalendar'

// ── Admin: Create-league form ─────────────────────────────────────────────
// Captures the full season calendar: signup deadline plus a date range per
// competition phase. Quarterfinals is optional — only fill it if you know
// you'll have 12+ teams per division.
export default function CreateLeagueForm({ onCancel, onCreated }) {
  const { createLeague } = useApp()
  const [name, setName] = useState('Summer 2026 Lobster League')
  const [descr, setDescr] = useState('')
  const [deadline, setDeadline] = useState('') // datetime-local
  // Phase ranges — one [start, end] pair per phase.
  const [gsStart, setGsStart] = useState('')
  const [gsEnd, setGsEnd] = useState('')
  const [qfStart, setQfStart] = useState('')
  const [qfEnd, setQfEnd] = useState('')
  const [sfStart, setSfStart] = useState('')
  const [sfEnd, setSfEnd] = useState('')
  const [fStart, setFStart] = useState('')
  const [fEnd, setFEnd] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !deadline) {
      setError('Name and signup deadline are required')
      return
    }
    setBusy(true)
    setError('')
    const { error: err } = await createLeague({
      name: name.trim(),
      description_md: descr.trim(),
      signup_closes_at: new Date(deadline).toISOString(),
      group_stage_start: gsStart || null,
      group_stage_end: gsEnd || null,
      quarters_start: qfStart || null,
      quarters_end: qfEnd || null,
      semis_start: sfStart || null,
      semis_end: sfEnd || null,
      finals_start: fStart || null,
      finals_end: fEnd || null,
    })
    setBusy(false)
    if (err) {
      setError(err.message || 'Could not create league')
      return
    }
    onCreated?.()
  }

  // Each range field uses the custom RangeCalendar — click start day, click
  // end day, stays open through month navigation, no native picker quirks.
  // minDate on a later phase is set to the previous phase's end so the admin
  // can't accidentally overlap phases; they CAN though (minDate is soft),
  // since Quarterfinals being skipped might back-date Semis.

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <p className="font-bold text-gray-700">🆕 Create a league</p>

      <div>
        <label className="label">League name</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Summer 2026 Lobster League"
        />
      </div>

      <div>
        <label className="label">Sign-up deadline</label>
        <input
          type="datetime-local"
          className="input"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          required
        />
        <p className="text-[11px] text-gray-400 mt-1">
          After this moment, new interests are blocked and the page shows "Sign-up closed."
        </p>
      </div>

      <div className="space-y-3 pt-2 border-t border-gray-100">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Phase dates</p>
        <PhaseRangeField
          label="Group Stage"
          hint="5 weeks"
          start={gsStart}
          end={gsEnd}
          onChange={({ start, end }) => {
            setGsStart(start || '')
            setGsEnd(end || '')
          }}
        />
        <PhaseRangeField
          label="Quarterfinals"
          hint="2 weeks, only with 12+ teams"
          optional
          start={qfStart}
          end={qfEnd}
          minDate={gsEnd}
          onChange={({ start, end }) => {
            setQfStart(start || '')
            setQfEnd(end || '')
          }}
        />
        <PhaseRangeField
          label="Semifinals"
          hint="2 weeks"
          start={sfStart}
          end={sfEnd}
          minDate={qfEnd || gsEnd}
          onChange={({ start, end }) => {
            setSfStart(start || '')
            setSfEnd(end || '')
          }}
        />
        <PhaseRangeField
          label="Finals"
          hint="Finals day"
          start={fStart}
          end={fEnd}
          minDate={sfEnd || qfEnd || gsEnd}
          onChange={({ start, end }) => {
            setFStart(start || '')
            setFEnd(end || '')
          }}
        />
      </div>

      <div>
        <label className="label">Description (optional — overrides the default intro)</label>
        <textarea
          className="input text-xs font-mono"
          rows={4}
          value={descr}
          onChange={(e) => setDescr(e.target.value)}
          placeholder="Leave empty to use the default league intro."
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm text-gray-500 font-semibold"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="btn-primary flex-1 py-2.5 text-sm disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create league'}
        </button>
      </div>
    </form>
  )
}
