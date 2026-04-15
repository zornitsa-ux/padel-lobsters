import React, { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { Plus, X, Trash2, LogIn } from 'lucide-react'
import { SignInBanner, useAuthPrompt } from './AuthGate'

// 🦞 Claw image buttons — transparent PNG, no background tricks needed
const CLAW_IMG = '/claws.png'

const ClawUp = ({ active, size = 34 }) => (
  <img
    src={CLAW_IMG}
    alt="like"
    style={{
      width: size,
      height: size,
      objectFit: 'contain',
      display: 'block',
      flexShrink: 0,
      opacity: active ? 1 : 0.35,
      transition: 'opacity 0.15s, transform 0.15s',
      transform: active ? 'scale(1.2)' : 'scale(1)',
      filter: active ? 'drop-shadow(0 0 4px rgba(220,38,38,0.5))' : 'none',
    }}
  />
)

const ClawDown = ({ active, size = 34 }) => (
  <img
    src={CLAW_IMG}
    alt="dislike"
    style={{
      width: size,
      height: size,
      objectFit: 'contain',
      display: 'block',
      flexShrink: 0,
      transition: 'filter 0.15s, transform 0.15s',
      transform: active ? 'scale(1.2) rotate(180deg)' : 'scale(1) rotate(180deg)',
      // Gray: light gray inactive, dark gray when pressed
      filter: active
        ? 'grayscale(1) brightness(0.45)'
        : 'grayscale(1) brightness(1.6)',
    }}
  />
)

export default function Updates({ onNavigate }) {
  const { updates, players, addUpdate, deleteUpdate, addReaction, isAdmin, claimedId } = useApp()
  const [showForm, setShowForm]         = useState(false)
  const [content, setContent]           = useState('')
  const [posting, setPosting]           = useState(false)

  // Identity is managed in Settings → Account, but for friction-free posting
  // we also pop a PIN prompt right where the player tapped. Either path lands
  // them in the same persistent session.
  const { requireAuth, AuthPromptModal } = useAuthPrompt({ onNavigate })
  const goToSignIn = () => onNavigate?.('settings')

  const activePlayers = players.filter(p => (p.status || 'active') === 'active')
  const myPlayer = activePlayers.find(p => String(p.id) === String(claimedId))

  const formatTime = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    const diff = (Date.now() - d) / 1000
    if (diff < 60)    return 'just now'
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  const handlePost = async (e) => {
    e.preventDefault()
    if (!claimedId || !content.trim()) return
    setPosting(true)
    await addUpdate(claimedId, content.trim())
    setContent('')
    setShowForm(false)
    setPosting(false)
  }

  const handleReact = (updateId, type) => {
    requireAuth('player', () => {
      // Re-read claimedId from localStorage in case sign-in just happened
      const cid = claimedId || localStorage.getItem('lobster_claimed_id')
      if (cid) addReaction(updateId, cid, type)
    }, { subtitle: 'Enter your PIN to react to this update.' })
  }

  const handleOpenPost = () => {
    requireAuth('player', () => setShowForm(true), {
      subtitle: 'Enter your PIN to post an update.',
    })
  }

  const getReactions = (update, type) =>
    (update.update_reactions || []).filter(r => r.type === type)

  const myReaction = (update, cid) =>
    (update.update_reactions || []).find(r => String(r.player_id) === String(cid))

  return (
    <div className="space-y-4">
      <AuthPromptModal />
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">Updates</h2>
        <button
          onClick={handleOpenPost}
          className="btn-primary py-2 px-4 text-sm flex items-center gap-1.5"
        >
          <Plus size={16} /> Post
        </button>
      </div>

      {/* Identity pill — now a status indicator + deep-link to Settings */}
      {myPlayer ? (
        <button
          onClick={goToSignIn}
          className="w-full flex items-center gap-2 bg-white rounded-2xl px-4 py-2.5 border border-gray-100 shadow-sm active:scale-[0.98] transition-all"
        >
          <span className="text-lg">🦞</span>
          <span className="text-sm text-gray-600 flex-1 text-left">
            <span className="font-semibold text-gray-800">{myPlayer.name}</span>
            <span className="text-gray-400 text-xs"> ✓ signed in — manage in Settings</span>
          </span>
        </button>
      ) : (
        <SignInBanner
          role="player"
          onNavigate={onNavigate}
          compact
          message="Sign in from Settings → Account to post, react, or comment."
        />
      )}

      {/* Feed */}
      {(!updates || updates.length === 0) ? (
        <div className="card py-10 text-center text-gray-400">
          <span className="text-4xl block mb-2">🦞</span>
          <p className="font-medium">No updates yet — be the first to post!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {updates.map(u => {
            const poster  = activePlayers.find(p => String(p.id) === String(u.player_id))
            const upList  = getReactions(u, 'up')
            const dnList  = getReactions(u, 'down')
            const mine    = myReaction(u, claimedId)
            return (
              <div key={u.id} className="card space-y-3">
                {/* Author + time */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {poster?.avatarUrl ? (
                      <img
                        src={poster.avatarUrl}
                        alt={poster.name}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-gray-100"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-lobster-teal rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {(poster?.name || '?')[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-sm text-gray-800">{poster?.name || 'Unknown'}</p>
                      <p className="text-[10px] text-gray-400">{formatTime(u.created_at)}</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => deleteUpdate(u.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-xl bg-red-50 active:scale-95 flex-shrink-0"
                    >
                      <Trash2 size={13} className="text-red-400" />
                    </button>
                  )}
                </div>

                {/* Content */}
                <p className="text-sm text-gray-700 leading-relaxed">{u.content}</p>

                {/* Reactions */}
                <div className="flex items-center gap-4 pt-1 border-t border-gray-50">
                  <button
                    onClick={() => handleReact(u.id, 'up')}
                    className="flex items-center gap-1.5 active:scale-95 transition-all"
                  >
                    <ClawUp active={mine?.type === 'up'} size={28} />
                    <span className={`text-sm font-semibold ${mine?.type === 'up' ? 'text-lobster-teal' : 'text-gray-400'}`}>
                      {upList.length || ''}
                    </span>
                  </button>
                  <button
                    onClick={() => handleReact(u.id, 'down')}
                    className="flex items-center gap-1.5 active:scale-95 transition-all"
                  >
                    <ClawDown active={mine?.type === 'down'} size={28} />
                    <span className={`text-sm font-semibold ${mine?.type === 'down' ? 'text-lob-coral' : 'text-gray-400'}`}>
                      {dnList.length || ''}
                    </span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Post form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-gray-800">New Update</h3>
              <button onClick={() => setShowForm(false)}><X size={22} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handlePost} className="space-y-4">
              <div>
                <label className="label">Posting as</label>
                {claimedId && myPlayer ? (
                  <div className="flex items-center gap-2 bg-lobster-teal/10 rounded-xl px-3 py-2.5">
                    <div className="w-7 h-7 bg-lobster-teal rounded-full flex items-center justify-center text-white font-bold text-xs">
                      {myPlayer.name[0].toUpperCase()}
                    </div>
                    <span className="font-semibold text-sm text-gray-800">{myPlayer.name}</span>
                    <span className="text-xs text-lobster-teal ml-1">✓ verified</span>
                  </div>
                ) : (
                  <button type="button" onClick={goToSignIn}
                    className="w-full bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 text-left active:scale-[0.99] transition-all flex items-center gap-2">
                    <LogIn size={13} />
                    Sign in from Settings → Account to post.
                  </button>
                )}
                {/* hidden input carries the player id */}
                <input type="hidden" value={claimedId || ''} />
              </div>
              <div>
                <label className="label">Message</label>
                <textarea
                  className="input resize-none"
                  rows={4}
                  placeholder="Share something with the Lobsters…"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  required
                  maxLength={500}
                />
                <p className="text-xs text-gray-400 text-right mt-0.5">{content.length}/500</p>
              </div>
              <button type="submit" disabled={posting} className="btn-primary w-full">
                {posting ? 'Posting…' : 'Post Update 🦞'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
