import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

// ─── Popup: shown when player hasn't updated in 1+ month ─────────────────────
export default function PlaytomicUpdatePrompt({ player, onDismiss, onUpdate }) {
  const [newScore, setNewScore] = useState(player?.playtomic_level ?? '')
  const [saving, setSaving] = useState(false)

  const stamp = () =>
    localStorage.setItem(`playtomic_prompted_${player.id}`, new Date().toISOString())

  const handleKeep = () => { stamp(); onDismiss() }

  const handleUpdate = async () => {
    if (!newScore) return
    setSaving(true)
    const { error } = await supabase
      .from('players')
      .update({
        playtomic_level: parseFloat(newScore),
        playtomic_updated_at: new Date().toISOString(),
      })
      .eq('id', player.id)
    setSaving(false)
    if (!error) { stamp(); onUpdate(parseFloat(newScore)); onDismiss() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5"
         style={{ background: 'rgba(28,43,48,0.6)' }}>
      <div className="w-full max-w-sm rounded-2xl p-7"
           style={{ background: '#FAF3E4', border: '1.5px solid rgba(61,122,138,0.2)' }}>

        <div className="text-center mb-5">
          <div className="text-4xl mb-2">🎾</div>
          <h2 className="text-base font-semibold mb-1" style={{ color: '#1C2B30' }}>
            Has your Playtomic score changed?
          </h2>
          <p className="text-sm" style={{ color: '#6B8A92', lineHeight: 1.5 }}>
            Your score on file is{' '}
            <span className="font-semibold" style={{ color: '#3D7A8A' }}>
              {player.playtomic_level ?? 'not set'}
            </span>
            . It's been over a month — want to update it?
          </p>
        </div>

        <div className="mb-5">
          <label className="block text-xs font-medium uppercase tracking-wider mb-2"
                 style={{ color: '#6B8A92' }}>
            New Playtomic level
          </label>
          <input
            type="number" min="1.0" max="7.0" step="0.1"
            value={newScore}
            onChange={e => setNewScore(e.target.value)}
            placeholder={`e.g. ${player.playtomic_level ?? '3.5'}`}
            className="w-full rounded-xl px-4 py-3 text-base outline-none"
            style={{ border: '1.5px solid rgba(61,122,138,0.25)', background: 'white', color: '#1C2B30' }}
          />
        </div>

        <div className="flex gap-3">
          <button onClick={handleKeep}
                  className="flex-1 py-3 rounded-xl text-sm font-medium"
                  style={{ border: '1.5px solid rgba(61,122,138,0.25)', background: 'white', color: '#6B8A92' }}>
            No change
          </button>
          <button onClick={handleUpdate} disabled={saving || !newScore}
                  className="flex-1 py-3 rounded-xl text-sm font-medium text-white"
                  style={{ background: newScore ? '#3D7A8A' : '#B0C8CE' }}>
            {saving ? 'Saving…' : 'Update'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Hook — use in Layout.jsx ─────────────────────────────────────────────────
// Usage:
//   const [showPrompt, dismissPrompt] = usePlaytomicPrompt(currentPlayer)
//   {showPrompt && <PlaytomicUpdatePrompt player={currentPlayer} onDismiss={dismissPrompt} onUpdate={...} />}
export function usePlaytomicPrompt(player) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!player?.id) return
    const lastPrompted = localStorage.getItem(`playtomic_prompted_${player.id}`)
    const lastUpdated  = player.playtomic_updated_at ? new Date(player.playtomic_updated_at) : null
    const oneMonthAgo  = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

    const notPromptedRecently = !lastPrompted || new Date(lastPrompted) < oneMonthAgo
    const notUpdatedRecently  = !lastUpdated  || lastUpdated < oneMonthAgo

    if (notPromptedRecently && notUpdatedRecently) {
      const t = setTimeout(() => setShow(true), 1500)
      return () => clearTimeout(t)
    }
  }, [player])

  return [show, () => setShow(false)]
}
