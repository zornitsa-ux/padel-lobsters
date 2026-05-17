import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { Users, Music, X } from 'lucide-react'

// ── Partner-invite modal ──────────────────────────────────────────────────
export default function InviteModal({ league, invitee, onClose, onSent }) {
  const { proposeLeagueTeam, leagueInterests } = useApp()
  const [teamName, setTeamName] = useState('')
  const [teamSong, setTeamSong] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!invitee) return null
  const myInterest = leagueInterests.find((i) => String(i.league_id) === String(league.id))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!teamName.trim()) {
      setError('Team name is required')
      return
    }
    setBusy(true)
    setError('')
    const { error: err } = await proposeLeagueTeam(
      league.id,
      invitee.id,
      teamName.trim(),
      teamSong.trim(),
      invitee.division || myInterest?.division || 'open',
      myInterest?.experience_level || null,
    )
    setBusy(false)
    if (err) {
      setError(err.message || 'Could not send invite')
      return
    }
    onSent?.()
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Invite {invitee.name?.split(' ')[0]}</h3>
          <button onClick={onClose}>
            <X size={20} className="text-gray-400" />
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Propose a team name + song. Once {invitee.name?.split(' ')[0]} accepts, you'll be locked
          in as partners.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label flex items-center gap-1">
              <Users size={12} /> Team name
            </label>
            <input
              className="input"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Smash & Grab"
              required
            />
          </div>
          <div>
            <label className="label flex items-center gap-1">
              <Music size={12} /> Team song (optional)
            </label>
            <input
              className="input"
              value={teamSong}
              onChange={(e) => setTeamSong(e.target.value)}
              placeholder="e.g. Eye of the Tiger"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full py-2.5 text-sm disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Send invite'}
          </button>
        </form>
      </div>
    </div>
  )
}
