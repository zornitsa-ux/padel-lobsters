import React, { useState, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../supabase'
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronUp, Search, User, Clock, Camera, Briefcase } from 'lucide-react'
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
  avatarUrl: '',
}

// ── Corporate Performance Review generator ───────────────────────────────────
function corpReview(player, matches = [], registrations = [], tournaments = []) {
  const lvl  = player.adjustedLevel || 0
  const name = (player.name || 'Employee').split(' ')[0]
  const pid  = player.id

  // ── Compute match stats ──────────────────────────────────────────────────
  const played = matches.filter(m =>
    m.completed && (m.team1Ids?.includes(pid) || m.team2Ids?.includes(pid))
  )
  let wins = 0, losses = 0
  played.forEach(m => {
    const onTeam1 = m.team1Ids?.includes(pid)
    const s1 = m.score1 ?? 0, s2 = m.score2 ?? 0
    if ((onTeam1 && s1 > s2) || (!onTeam1 && s2 > s1)) wins++
    else losses++
  })
  const totalMatches = wins + losses
  const winRate = totalMatches >= 4 ? wins / totalMatches : null

  // ── Compute tournament attendance ────────────────────────────────────────
  const tournamentsPlayed = new Set(
    registrations
      .filter(r => r.playerId === pid && r.status === 'registered')
      .map(r => r.tournamentId)
  ).size
  const totalTournaments = tournaments.length

  // ── Compute last-tournament rank ─────────────────────────────────────────
  let lastTournamentRank = null
  let lastTournamentTotal = null
  if (tournaments.length > 0) {
    const lastT = [...tournaments].sort((a, b) => new Date(b.date) - new Date(a.date))[0]
    const lastMs = matches.filter(m => String(m.tournamentId) === String(lastT.id) && m.completed)
    if (lastMs.length > 0) {
      const allIds = [...new Set([
        ...lastMs.flatMap(m => m.team1Ids || []),
        ...lastMs.flatMap(m => m.team2Ids || []),
      ])]
      lastTournamentTotal = allIds.length
      const winsMap = Object.fromEntries(allIds.map(id => [id, 0]))
      lastMs.forEach(m => {
        const s1 = m.score1 ?? 0, s2 = m.score2 ?? 0
        const winners = s1 > s2 ? m.team1Ids : s2 > s1 ? m.team2Ids : []
        ;(winners || []).forEach(id => { if (winsMap[id] !== undefined) winsMap[id]++ })
      })
      const ranked = Object.entries(winsMap).sort(([, a], [, b]) => b - a)
      const pos = ranked.findIndex(([id]) => String(id) === String(pid))
      if (pos >= 0) lastTournamentRank = pos + 1
    }
  }

  // ── No tournament history yet ────────────────────────────────────────────
  if (tournamentsPlayed === 0) {
    const welcome = [
      `${name} has not yet competed in a tournament. Their record is, technically, perfect. We strongly encourage them to preserve this while they still can.`,
      `No tournament history on file. ${name} remains, officially, an unknown quantity. The group is curious. The committee is hopeful. The courts are ready.`,
      `Pre-season assessment only. ${name} has yet to play a tournament, which means anything is still possible. We find this genuinely exciting and recommend they sign up before reality sets in.`,
    ]
    return welcome[(player.id || 0) % welcome.length]
  }

  // ── Scenario matching (priority order) ───────────────────────────────────

  // Dead last in most recent tournament — high skill
  if (lastTournamentRank !== null && lastTournamentTotal >= 4 && lastTournamentRank === lastTournamentTotal) {
    if (lvl >= 3.5) {
      return `A Playtomic rating of ${lvl.toFixed(1)} and yet — last place. Scientists are studying this. The data doesn't lie but it does appear to be deeply confused. A walking contradiction, somehow making the rest of us feel both inferior and hopeful at the same time.`
    }
    return `Came last. Consistent, reliable, always there at the bottom holding the group together. Not everyone can win — someone has to make the winners feel good, and ${name} does this selflessly, every single time.`
  }

  // Won the most recent tournament
  if (lastTournamentRank === 1 && lastTournamentTotal >= 4) {
    return `Won the whole thing. Showed up, dominated, went home. The rest of the group is currently reviewing their life choices. ${name} is not available for comment — they're too busy being better than everyone else.`
  }

  // High skill, bad win rate — the unexplained gap
  if (lvl >= 3.5 && winRate !== null && winRate < 0.35) {
    return `Playtomic says elite. Match results say… something else entirely. Currently the most expensive mystery in the group. Investigations are ongoing. The committee remains baffled and slightly impressed.`
  }

  // Low skill, strong win rate — the secret weapon
  if (lvl < 2.5 && winRate !== null && winRate > 0.6) {
    return `Low rating, suspiciously high win rate. Either sandbagging at a professional level or has discovered something the rest of us haven't.`
  }

  // Dominant win rate
  if (winRate !== null && winRate >= 0.7) {
    return `Wins constantly. Shows up, wins, leaves. Has made winning look so routine that the group has started taking it personally. At this point, the committee is actively considering whether ${name} should remain eligible for the next invitation.`
  }

  // Committed loser
  if (winRate !== null && winRate <= 0.25) {
    return `Loses frequently, returns every time. This is either extraordinary mental resilience or a complete absence of self-preservation instinct. Either way, the courts wouldn't be the same without them. Truly the heart of the group.`
  }

  // The Ironman — attended every tournament
  if (totalTournaments >= 3 && tournamentsPlayed >= totalTournaments) {
    return `Has attended every single tournament. Every. Single. One. Rain, wind, scheduling conflicts, life events — none of it mattered. We're not sure if this is dedication or if they simply have nowhere else to be. Both are valid.`
  }

  // The Ghost — barely shows up
  if (totalTournaments >= 3 && tournamentsPlayed <= 1) {
    return `Has appeared at approximately one tournament. Like a rare weather event — talked about, rarely witnessed. The group respects the mystery. Statistically, anything could happen next. Nobody knows. Not even ${name}.`
  }

  // Perfectly mediocre
  if (winRate !== null && winRate >= 0.45 && winRate <= 0.55 && totalMatches >= 6) {
    return `Win rate hovering in the 45–55% range across six or more matches. A statistical masterpiece. Not good enough to be intimidating, not bad enough to be endearing. Just perfectly, beautifully average. The bell curve's favourite child.`
  }

  // ── Fallback: level-based ─────────────────────────────────────────────────
  const low = [
    `Internal assessments confirm that ${name} is still, technically, learning padel. Leadership has described their progress as "visible." This is the most positive framing available to us at this time.`,
    `${name} shows up. They swing. Things happen — not always the intended things, but things. HR has flagged "presence" as a genuine strength and is working hard to find a second one.`,
    `${name}'s development metrics remain in an early phase. We want to be encouraging. We also want to be accurate. Balancing these two goals has made this the most difficult review in the organisation.`,
  ]
  const mid = [
    `${name} is, by all available data, fine. Not remarkable. Not a disaster. Fine. Writing this review took longer than expected.`,
    `${name} wins some, loses some, and generates very few strong opinions in any direction. HR has described this as "low-maintenance." We mean that as a compliment. Mostly.`,
    `${name} has successfully avoided both the top and the bottom of the leaderboard for the entire season. Whether this is strategy or coincidence, the result is the same: a perfectly adequate year. We have noted this.`,
  ]
  const high = [
    `${name} is genuinely good at this. We are not used to saying this without caveats. There are no caveats. Please do not tell ${name}. They may already know and we are concerned about what happens next.`,
    `The data on ${name} is, frankly, difficult to criticise. They win. They contribute. They do not create HR incidents. Leadership has described this as "ideal" and immediately moved on to people who are more complicated.`,
    `${name} is one of the better players in this group, a fact they are presumably aware of and hopefully managing with appropriate humility. We have no evidence of inappropriate humility. We are monitoring the situation.`,
  ]
  const elite = [
    `${name} is, statistically, too good for this group. We have chosen to view this as their problem. Our official position is that it raises the average and we benefit from the association. ${name} has not been told this.`,
    `HR has reviewed ${name}'s match data and formally acknowledged that it creates a benchmarking problem for everyone else in the group. This is considered a net positive. The rest of the group is divided on that assessment.`,
  ]
  const pool = lvl < 2 ? low : lvl < 3.5 ? mid : lvl < 5 ? high : elite
  // hash works for both integer and UUID string IDs
  const idHash = String(player.id || '0').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return pool[idHash % pool.length]
}

// ── Player avatar component ───────────────────────────────────────────────────
function PlayerAvatar({ player, size = 'md', className = '' }) {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-14 h-14 text-lg' }
  const cls = sizes[size] || sizes.md
  if (player.avatarUrl) {
    return (
      <img
        src={player.avatarUrl}
        alt={player.name}
        className={`${cls} rounded-full object-cover flex-shrink-0 ${className}`}
        onError={e => { e.target.style.display = 'none'; e.target.nextSibling?.style && (e.target.nextSibling.style.display = 'flex') }}
      />
    )
  }
  return (
    <div className={`${cls} bg-lobster-teal rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${className}`}>
      {(player.name || '?')[0].toUpperCase()}
    </div>
  )
}

export default function Players() {
  const { players, addPlayer, updatePlayer, deletePlayer, isAdmin, matches, registrations, tournaments } = useApp()
  const [showForm, setShowForm]     = useState(false)
  const [editId, setEditId]         = useState(null)
  const [form, setForm]             = useState(emptyForm)
  const [search, setSearch]         = useState('')
  const [showLogin, setShowLogin]   = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [saving, setSaving]         = useState(false)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const fileInputRef = useRef(null)

  const activePlayers  = players.filter(p => (p.status || 'active') === 'active')
  const pendingPlayers = players.filter(p => p.status === 'pending')

  const filtered = activePlayers.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  )
  const sorted = [...filtered].sort((a, b) => (b.adjustedLevel || 0) - (a.adjustedLevel || 0))

  // ── Smart name display: first name only, add surname initial on duplicates ─
  const firstNameCount = {}
  activePlayers.forEach(p => {
    const fn = (p.name || '').trim().split(/\s+/)[0]
    firstNameCount[fn] = (firstNameCount[fn] || 0) + 1
  })
  const displayName = (p) => {
    const parts = (p.name || '').trim().split(/\s+/)
    const fn = parts[0] || '?'
    if (firstNameCount[fn] > 1 && parts.length > 1) {
      return `${fn} ${parts[1][0].toUpperCase()}`
    }
    return fn
  }

  const openAdd = () => {
    setForm(emptyForm); setEditId(null); setAvatarFile(null); setAvatarPreview(null); setShowForm(true)
  }

  const openEdit = (p) => {
    if (!isAdmin) { setShowLogin(true); return }
    setForm({
      name: p.name || '', email: p.email || '', phone: p.phone || '',
      playtomicLevel: p.playtomicLevel ?? '', adjustment: p.adjustment ?? '0',
      playtomicUsername: p.playtomicUsername || '', notes: p.notes || '',
      gender: p.gender || '', isLeftHanded: p.isLeftHanded || false,
      avatarUrl: p.avatarUrl || '',
    })
    setAvatarFile(null)
    setAvatarPreview(p.avatarUrl || null)
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

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      let avatarUrl = form.avatarUrl || ''
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop()
        const filename = `player-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('avatars').upload(filename, avatarFile, { upsert: true })
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filename)
          avatarUrl = publicUrl
        }
      }
      const data = {
        ...form,
        avatarUrl,
        playtomicLevel: parseFloat(form.playtomicLevel) || 0,
        adjustment: parseFloat(form.adjustment) || 0,
        isLeftHanded: form.isLeftHanded || false,
        status: editId ? undefined : (isAdmin ? 'active' : 'pending'),
      }
      if (editId) await updatePlayer(editId, data)
      else        await addPlayer(data)
      setShowForm(false)
      setAvatarFile(null); setAvatarPreview(null)
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

      {/* Pending approvals */}
      {isAdmin && pendingPlayers.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-orange-500" />
            <p className="text-sm font-bold text-orange-600">Pending Approval</p>
          </div>
          {pendingPlayers.map(p => (
            <div key={p.id} className="card border-l-4 border-orange-300">
              <div className="flex items-center gap-3">
                <PlayerAvatar player={p} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">
                    {p.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    Lv {(p.adjustedLevel || 0).toFixed(1)}
                    {p.email && ` · ${p.email}`}
                  </p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => handleApprove(p)}
                    className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-xl font-semibold active:scale-95 transition-all">
                    Approve
                  </button>
                  <button onClick={() => handleReject(p.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-50 active:scale-95">
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
        <input className="input pl-9" placeholder="Search players..." value={search}
          onChange={e => setSearch(e.target.value)} />
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
            <div key={p.id} className="card transition-all">
              <div className="w-full" onClick={() => setExpandedId(expanded ? null : p.id)}>
                {/* Top row: rank · avatar · name · level · chevron */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-5 text-center flex-shrink-0">
                    #{idx + 1}
                  </span>
                  <PlayerAvatar player={p} />
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-semibold text-gray-800 truncate flex items-center gap-1">
                      {displayName(p)}
                      {p.isLeftHanded && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold ml-0.5">L</span>}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${levelBadge(p.adjustedLevel)}`}>
                      {(p.adjustedLevel || 0).toFixed(1)}
                    </span>
                  </div>
                  {expanded
                    ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
                    : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
                </div>
                {/* Review preview — always visible */}
                <p className="text-xs text-gray-400 italic mt-2 leading-relaxed line-clamp-2 pl-8">
                  {corpReview(p, matches, registrations, tournaments)}
                </p>
              </div>

              {expanded && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                  {/* Stats grid */}
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

                  {/* Tags */}
                  {p.isLeftHanded && (
                    <div className="flex gap-2 flex-wrap">
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">🤚 Left-handed</span>
                    </div>
                  )}

                  {isAdmin && (p.email || p.phone) && (
                    <div className="space-y-1">
                      {p.email && <p className="text-xs text-gray-500">✉ {p.email}</p>}
                      {p.phone && <p className="text-xs text-gray-500">📞 {p.phone}</p>}
                    </div>
                  )}
                  {p.notes && <p className="text-xs text-gray-500 italic">{p.notes}</p>}

                  {/* Corporate Review — full text in expanded view */}
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Briefcase size={11} className="text-gray-400" />
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Annual Performance Review</p>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed italic">{corpReview(p, matches, registrations, tournaments)}</p>
                  </div>

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
              <button onClick={() => { setShowForm(false); setAvatarFile(null); setAvatarPreview(null) }}>
                <X size={22} className="text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">

              {/* Avatar upload */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Preview"
                      className="w-20 h-20 rounded-full object-cover border-2 border-lobster-teal" />
                  ) : (
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300">
                      <User size={28} />
                    </div>
                  )}
                  <button type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 w-7 h-7 bg-lobster-teal rounded-full flex items-center justify-center text-white shadow-sm active:scale-95">
                    <Camera size={13} />
                  </button>
                </div>
                <p className="text-xs text-gray-400">Tap camera icon to add photo</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>

              <div>
                <label className="label">Full Name *</label>
                <input required className="input" placeholder="e.g. Maria García" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              {/* Gender — for optimal pair matching */}
              <div>
                <label className="label">Gender</label>
                <p className="text-xs text-gray-400 mb-2">For optimal pair matching</p>
                <div className="flex gap-3">
                  {[['male', 'Male'], ['female', 'Female']].map(([val, lbl]) => (
                    <button type="button" key={val}
                      onClick={() => setForm(f => ({ ...f, gender: f.gender === val ? '' : val }))}
                      className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                        form.gender === val ? 'bg-lobster-teal text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Left-handed */}
              <div>
                <label className="label">Playing hand</label>
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, isLeftHanded: !f.isLeftHanded }))}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all w-full justify-center ${
                    form.isLeftHanded
                      ? 'bg-amber-100 text-amber-700 border-2 border-amber-300'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                  🤚 {form.isLeftHanded ? 'Left-handed (tap to undo)' : 'Tap if left-handed'}
                </button>
              </div>

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
                    Positive = stronger · Negative = weaker<br />
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
