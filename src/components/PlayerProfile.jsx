import { useState } from 'react'
import { supabase } from '../supabase'

export default function PlayerProfile({ player, onSave }) {
  const [playtomic, setPlaytomic] = useState(player?.playtomic_level ?? '')
  const [tagline, setTagline]     = useState(player?.tagline ?? '')
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)

  const hasChanges =
    String(playtomic) !== String(player?.playtomic_level ?? '') ||
    tagline !== (player?.tagline ?? '')

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('players')
      .update({
        playtomic_level: playtomic ? parseFloat(playtomic) : null,
        tagline: tagline.trim() || null,
        playtomic_updated_at: new Date().toISOString(),
      })
      .eq('id', player.id)
    setSaving(false)
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      onSave?.({ ...player, playtomic_level: parseFloat(playtomic), tagline })
    }
  }

  const initials = (player?.name ?? '?')
    .split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="rounded-2xl overflow-hidden"
         style={{ border: '1px solid rgba(61,122,138,0.15)' }}>

      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-5"
           style={{ background: '#2A5A68' }}>
        <div className="flex-shrink-0 flex items-center justify-center rounded-full text-white font-semibold text-lg"
             style={{ width: 52, height: 52, background: '#E8A030', border: '2px solid rgba(255,255,255,0.3)' }}>
          {initials}
        </div>
        <div>
          <div className="text-white font-semibold text-base">{player?.name ?? 'Your profile'}</div>
          <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Lobster since {player?.created_at ? new Date(player.created_at).getFullYear() : '?'}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="p-5 flex flex-col gap-5" style={{ background: 'white' }}>

        {/* Playtomic level */}
        <div>
          <label style={labelStyle}>Playtomic level</label>
          <div className="relative">
            <input
              type="number" min="1.0" max="7.0" step="0.1"
              value={playtomic}
              onChange={e => setPlaytomic(e.target.value)}
              placeholder="e.g. 3.5"
              style={inputStyle}
              className="w-full"
            />
            {player?.playtomic_level && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                    style={{ color: '#9BADB2' }}>
                currently {player.playtomic_level}
              </span>
            )}
          </div>
          <p style={hintStyle}>Your current level on Playtomic (1.0 – 7.0)</p>
        </div>

        {/* Tagline */}
        <div>
          <label style={labelStyle}>Your Lobster add-on</label>
          <input
            type="text"
            value={tagline}
            onChange={e => setTagline(e.target.value)}
            placeholder="e.g. The one who always calls the ball out"
            maxLength={80}
            style={inputStyle}
            className="w-full"
          />
          <p style={hintStyle}>
            Appears on your player card. Keep it fun. {80 - tagline.length} chars left.
          </p>
        </div>

        {/* Last updated */}
        {player?.playtomic_updated_at && (
          <div className="rounded-xl px-3 py-2.5 text-xs"
               style={{ background: '#EAF4F7', color: '#3D7A8A' }}>
            Last updated:{' '}
            {new Date(player.playtomic_updated_at).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </div>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="w-full py-3.5 rounded-xl text-sm font-medium text-white transition-colors"
          style={{ background: hasChanges ? '#D94F2B' : '#E0D5C8', cursor: hasChanges ? 'pointer' : 'not-allowed' }}>
          {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

const labelStyle = {
  display: 'block',
  fontSize: '11px',
  fontWeight: '500',
  color: '#6B8A92',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: '8px',
}

const inputStyle = {
  padding: '12px 14px',
  borderRadius: '10px',
  border: '1.5px solid rgba(61,122,138,0.2)',
  background: '#FAFAFA',
  fontSize: '15px',
  color: '#1C2B30',
  outline: 'none',
  boxSizing: 'border-box',
}

const hintStyle = {
  fontSize: '11px',
  color: '#9BADB2',
  margin: '5px 0 0',
  lineHeight: 1.4,
}
