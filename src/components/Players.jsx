import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronUp, Search, User, CheckCircle, Clock } from 'lucide-react'
import AdminLogin from './AdminLogin'

const LEVEL_COLORS = [
  'bg-gray-200 text-gray-700',
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-teal-100 text-teal-700',
  'bg-yellow-100 text-yellow-700',
  'bg-orange-100 text-orange-700',
  'bg-red-100 text-red-700',
  'bg-purple-100 text-purple-700',
]

const emptyForm = {
  name: '', email: '', phone: '',
  playtomicLevel: '', adjustment: '0',
  playtomicUsername: '', notes: '', gender: '',
  isLeftHanded: false,
}

export default function Players() {
  const { players, addPlayer, updatePlayer, deletePlayer, isAdmin, setIsAdmin } = useApp()
  const [showForm, setShowForm]     = useState(false)
  const [editId, setEditId]         = useState(null)
  const [form, setForm]             = useState(emptyForm)
  const [search, setSearch]         = useState('')
  const [showLogin, setShowLogin]   = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [saving, setSaving]         = useState(false)

  // Active players only in the main list
  const activePlayers = players.filter(p => (p.status || 'active') === 'active')
  const pendingPlayers = players.filter(p => p.status === 'pending')

  const filtered = activePlayers.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.playtomicUsername?.toLowerCase().includes(search.toLowerCase())
  )
  const sorted = [...filtered].sort((a, b) => (b.adjustedLevel || 0) - (a.adjustedLevel || 0))

  // Anyone can open the Add form — no PIN needed
  const openAdd = () => {
    setForm(emptyForm); setEditId(null); setShowForm(true)
  }

  const openEdit = (p) => {
    if (!isAdmin) { setShowLogin(true); return }
    setForm({
      name: p.name || '', email: p.email || '', phone: p.phone || '',
      playtomicLevel: p.playtomicLevel ?? '', adjustment: p.adjustment ?? '0',
      playtomicUsername: p.playtomicUsername || '', notes: p.notes || '',
      gender: p.gender || '', isLeftHanded: p.isLeftHanded || false,
    })
    setEditId(p.id); setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!isAdmin) { setShowLogin(true); return }
    if (!confirm('Remove this player?')) return
    await deletePlayer(id)
  }

  const handleApprove = async (p) => {
    await updatePlayer(p.id, { ...p, status: 'active' })
  }

  const handleReject = async (id) => {
    if (!confirm('Reject and remove this registration request?')) return
    await deletePlayer(id)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const data = {
        ...form,
        playtomicLevel: parseFloat(form.playtomicLevel) || 0,
        adjustment: parseFloat(form.adjustment) || 0,
        isLeftHanded: form.isLeftHanded || false,
        // Admin adds directly as active; self-registration goes to pending
        status: editId ? undefined : (isAdmin ? 'active' : 'pending'),
      }
      if (editId) await updatePlayer(editId, data)
      else        await addPlayer(data)
      setShowForm(false)
      if (!isAdmin && !editId) {
        alert('Your registration request has been sent! The admin will approve it shortly.')
      }
    } finally {
      setSaving(false)
    }
  }

  const levelBadge = (adjusted) => {
    const idx = Math.min(7, Math.max(0, Math.floor(adjusted || 0)))
    return LEVEL_COLORS[idx] || LEVEL_COLORS[0]
  }

  const genderIcon = (g) => g === 'female' ? '♀' : g === 'male' ? '♂' : ''

  return (
    <div className="space-y-4">
      {showLogin && <AdminLogin onClose={() => setShowLogin(false)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">
          Players ({activePlayers.length})
          {pendingPlayers.length > 0 && isAdmin && (
            <span className="ml-2 text-xs bg-orange-100 text-orange-600 font-semibold px-2 py-0.5 rounded-full">
              {pendingPlayers.length} pending
            </span>
          )}
        </h2>
        <button onClick={openAdd} className="btn-primary py-2 px-4 text-sm flex items-center gap-1.5">
          <Plus size={16} /> Join
        </button>
      </div>

      {/* Pending approvals — admin only */}
      {isAdmin && pendingPlayers.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-orange-500" />
            <p className="text-sm font-bold text-orange-600">Pending Approval</p>
          </div>
          {pendingPlayers.map(p => (
            <div key={p.id} className="card border-l-4 border-orange-300">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold flex-shrink-0">
                  {(p.name || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">
                    {p.name} {genderIcon(p.gender) && <span className="text-gray-400 text-sm">{genderIcon(p.gender)}</span>}
                  </p>
                  <p className="text-xs text-gray-500">
                    Lv {(p.adjustedLevel || 0).toFixed(1)}
                    {p.email && ` · ${p.email}`}
                  </p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleApprove(p)}
                    className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-xl font-semibold active:scale-95 transition-all"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(p.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-50 active:scale-95"
                  >
                    <X size={13} className="text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="Search players..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Level legend */}
      <div className="card py-3">
        <p className="text-xs font-semibold text-gray-500 mb-1">Adjusted Playtomic Level</p>
        <p className="text-xs text-gray-500">
          Players enter their Playtomic level (0–7) and can apply a personal adjustment.
          The <strong>Adjusted Level</strong> is used for pairing.
        </p>
      </div>

      {/* Player list */}
      <div className="space-y-2">
        {sorted.length === 0 && (
          <div className="card py-10 text-center text-gray-400">
            <User size={36} className="mx-auto mb-2 opacity-30" />
            <p>No players yet. Be the first to join!</p>
          </div>
        )}

        {sorted.map((p, idx) => {
          const expanded = expandedId === p.id
          return (
            <div key={p.id} className="card">
              <button
                className="w-full flex items-center gap-3"
                onClick={() => setExpandedId(expanded ? null : p.id)}
              >
                <span className="text-xs font-bold text-gray-400 w-5 text-center flex-shrink-0">
                  #{idx + 1}
                </span>
                <div className="w-10 h-10 bg-lobster-teal rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                  {(p.name || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-semibold text-gray-800 truncate flex items-center gap-1">
                    {p.name}
                    {p.gender && <span className="text-gray-400 text-sm">{genderIcon(p.gender)}</span>}
                    {p.isLeftHanded && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold ml-0.5">L</span>}
                  </p>
                  {p.playtomicUsername && (
                    <p className="text-xs text-gray-400 truncate">@{p.playtomicUsername}</p>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${levelBadge(p.adjustedLevel)}`}>
                    {(p.adjustedLevel || 0).toFixed(1)}
                  </span>
                </div>
                {expanded
                  ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
                  : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
                }
              </button>

              {expanded && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-50 rounded-xl p-2">
                      <p className="text-base font-bold text-gray-700">{(p.playtomicLevel || 0).toFixed(1)}</p>
                      <p className="text-[10px] text-gray-500">Playtomic</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2">
                      <p className={`text-base font-bold ${parseFloat(p.adjustment) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {parseFloat(p.adjustment) >= 0 ? '+' : ''}{(p.adjustment || 0)}
                      </p>
                      <p className="text-[10px] text-gray-500">Adjustment</p>
                    </div>
                    <div className={`rounded-xl p-2 ${levelBadge(p.adjustedLevel)}`}>
                      <p className="text-base font-bold">{(p.adjustedLevel || 0).toFixed(1)}</p>
                      <p className="text-[10px] opacity-70">Adjusted</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {p.gender && (
                      <span className="text-xs text-gray-500">{p.gender === 'male' ? '♂ Male' : '♀ Female'}</span>
                    )}
                    {p.isLeftHanded && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">🤚 Left-handed</span>
                    )}
                  </div>
                  {p.email && <p className="text-xs text-gray-500">✉ {p.email}</p>}
                  {p.phone && <p className="text-xs text-gray-500">📞 {p.phone}</p>}
                  {p.notes && <p className="text-xs text-gray-500 italic">{p.notes}</p>}

                  {isAdmin && (
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => openEdit(p)} className="btn-secondary flex-1 py-2 text-sm flex items-center justify-center gap-1">
                        <Pencil size={14} /> Edit
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="btn-danger flex-1 py-2 text-sm flex items-center justify-center gap-1">
                        <Trash2 size={14} /> Remove
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-md max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-800">{editId ? 'Edit Player' : 'Join the Lobsters'}</h2>
                {!editId && !isAdmin && (
                  <p className="text-xs text-gray-500 mt-0.5">Your request will be approved by the admin</p>
                )}
              </div>
              <button onClick={() => setShowForm(false)}>
                <X size={22} className="text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="label">Full Name *</label>
                <input required className="input" placeholder="e.g. Maria García" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              {/* Gender */}
              <div>
                <label className="label">Gender</label>
                <p className="text-xs text-gray-400 mb-2">For optimal pair matching</p>
                <div className="flex gap-3">
                  {[['male', '♂ Male'], ['female', '♀ Female']].map(([val, lbl]) => (
                    <button
                      type="button" key={val}
                      onClick={() => setForm(f => ({ ...f, gender: f.gender === val ? '' : val }))}
                      className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                        form.gender === val
                          ? 'bg-lobster-teal text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Left-handed */}
              <div>
                <label className="label">Playing hand</label>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, isLeftHanded: !f.isLeftHanded }))}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all w-full justify-center ${
                    form.isLeftHanded
                      ? 'bg-amber-100 text-amber-700 border-2 border-amber-300'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  🤚 {form.isLeftHanded ? 'Left-handed (tap to undo)' : 'Tap if left-handed'}
                </button>
              </div>

              <div>
                <label className="label">Playtomic Username</label>
                <input className="input" placeholder="@username" value={form.playtomicUsername}
                  onChange={e => setForm(f => ({ ...f, playtomicUsername: e.target.value }))} />
              </div>

              {/* Level section */}
              <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Playtomic Level</p>
                <div>
                  <label className="label">Playtomic Level (0–7)</label>
                  <input type="number" step="0.1" min="0" max="7" className="input" placeholder="e.g. 3.5"
                    value={form.playtomicLevel}
                    onChange={e => setForm(f => ({ ...f, playtomicLevel: e.target.value }))} />
                  <p className="text-xs text-gray-500 mt-1">Check your Playtomic app — it shows your current level</p>
                </div>
                <div>
                  <label className="label">Personal Adjustment</label>
                  <input type="number" step="0.1" min="-3" max="3" className="input" placeholder="0"
                    value={form.adjustment}
                    onChange={e => setForm(f => ({ ...f, adjustment: e.target.value }))} />
                  <p className="text-xs text-gray-500 mt-1">
                    Positive = stronger than Playtomic suggests · Negative = weaker<br />
                    Adjusted Level = {((parseFloat(form.playtomicLevel) || 0) + (parseFloat(form.adjustment) || 0)).toFixed(1)}
                  </p>
                </div>
              </div>

              <div>
                <label className="label">Email</label>
                <input type="email" className="input" placeholder="player@email.com" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>

              <div>
                <label className="label">Phone / WhatsApp</label>
                <input type="tel" className="input" placeholder="+31 6 12345678" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea className="input resize-none" rows={2} placeholder="Any notes..." value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              <button type="submit" disabled={saving} className="btn-primary w-full">
                {saving ? 'Saving...' : editId ? 'Save Changes' : isAdmin ? 'Add Player' : 'Send Registration Request'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
