import React, { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { Plus, X, Trash2 } from 'lucide-react'

// 🦞 rotated = claw directions
const ClawUp = ({ active, size = 20 }) => (
  <span
    style={{
      display: 'inline-block',
      transform: 'rotate(-90deg)',
      fontSize: size,
      lineHeight: 1,
      filter: active ? 'none' : 'grayscale(1) opacity(0.45)',
      transition: 'filter 0.15s',
    }}
  >🦞</span>
)

const ClawDown = ({ active, size = 20 }) => (
  <span
    style={{
      display: 'inline-block',
      transform: 'rotate(90deg)',
      fontSize: size,
      lineHeight: 1,
      filter: active ? 'none' : 'grayscale(1) opacity(0.45)',
      transition: 'filter 0.15s',
    }}
  >🦞</span>
)

const STORAGE_KEY = 'lobster_my_player_id'

export default function Updates() {
  const { updates, players, addUpdate, deleteUpdate, addReaction, isAdmin } = useApp()
  const [showForm, setShowForm]       = useState(false)
  const [myPlayerId, setMyPlayerId]   = useState(() => localStorage.getItem(STORAGE_KEY) || '')
  const [postAs, setPostAs]           = useState('')
  const [content, setContent]         = useState('')
  const [posting, setPosting]         = useState(false)
  const [showIdentity, setShowIdentity] = useState(false)
  const [pickFor, setPickFor]         = useState(null) // { updateId, type } — pending reaction

  const activePlayers = players.filter(p => (p.status || 'active') === 'active')
  const myPlayer = activePlayers.find(p => String(p.id) === String(myPlayerId))

  useEffect(() => {
    if (myPlayerId) localStorage.setItem(STORAGE_KEY, myPlayerId)
  }, [myPlayerId])

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
    if (!postAs || !content.trim()) return
    setPosting(true)
    await addUpdate(postAs, content.trim())
    setMyPlayerId(postAs)
    setContent('')
    setPostAs('')
    setShowForm(false)
    setPosting(false)
  }

  const handleReact = (updateId, type) => {
    if (!myPlayerId) {
      setPickFor({ updateId, type })
      setShowIdentity(true)
      return
    }
    addReaction(updateId, myPlayerId, type)
  }

  const confirmIdentity = (pid) => {
    setMyPlayerId(pid)
    setShowIdentity(false)
    if (pickFor) {
      addReaction(pickFor.updateId, pid, pickFor.type)
      setPickFor(null)
    }
  }

  const getReactions = (update, type) =>
    (update.update_reactions || []).filter(r => r.type === type)

  const myReaction = (update) =>
    (update.update_reactions || []).find(r => String(r.player_id) === String(myPlayerId))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">Updates</h2>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary py-2 px-4 text-sm flex items-center gap-1.5"
        >
          <Plus size={16} /> Post
        </button>
      </div>

      {/* Identity pill */}
      <button
        onClick={() => { setShowIdentity(true); setPickFor(null) }}
        className="w-full flex items-center gap-2 bg-white rounded-2xl px-4 py-2.5 border border-gray-100 shadow-sm active:scale-[0.98] transition-all"
      >
        <span className="text-lg">🦞</span>
        <span className="text-sm text-gray-600 flex-1 text-left">
          {myPlayer
            ? <><span className="font-semibold text-gray-800">{myPlayer.name}</span> <span className="text-gray-400 text-xs">— tap to change</span></>
            : <span className="text-gray-400">Tap to set your profile for reactions & posts</span>
          }
        </span>
      </button>

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
            const mine    = myReaction(u)
            return (
              <div key={u.id} className="card space-y-3">
                {/* Author + time */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-lobster-teal rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {(poster?.name || '?')[0].toUpperCase()}
                    </div>
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
                    <ClawUp active={mine?.type === 'up'} size={18} />
                    <span className={`text-sm font-semibold ${mine?.type === 'up' ? 'text-lobster-teal' : 'text-gray-400'}`}>
                      {upList.length || ''}
                    </span>
                  </button>
                  <button
                    onClick={() => handleReact(u.id, 'down')}
                    className="flex items-center gap-1.5 active:scale-95 transition-all"
                  >
                    <ClawDown active={mine?.type === 'down'} size={18} />
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
                <label className="label">Post as</label>
                <select
                  className="input"
                  value={postAs}
                  onChange={e => setPostAs(e.target.value)}
                  required
                >
                  <option value="">Select your name…</option>
                  {activePlayers.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
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

      {/* Identity picker modal */}
      {showIdentity && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-md p-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-gray-800">Who are you?</h3>
              <button onClick={() => { setShowIdentity(false); setPickFor(null) }}>
                <X size={22} className="text-gray-400" />
              </button>
            </div>
            <p className="text-xs text-gray-400">Select your profile so your reactions and posts are attributed correctly.</p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {activePlayers.map(p => (
                <button
                  key={p.id}
                  onClick={() => confirmIdentity(p.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all active:scale-[0.98] ${
                    String(myPlayerId) === String(p.id)
                      ? 'bg-lobster-teal/10 border-2 border-lobster-teal'
                      : 'bg-gray-50 border-2 border-transparent'
                  }`}
                >
                  <div className="w-9 h-9 bg-lobster-teal rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {p.name[0].toUpperCase()}
                  </div>
                  <span className="font-semibold text-gray-800 text-sm">{p.name}</span>
                  {String(myPlayerId) === String(p.id) && (
                    <span className="ml-auto text-xs text-lobster-teal font-semibold">current</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
