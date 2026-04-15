import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../supabase'
import { Plus, Pencil, Trash2, X, ChevronDown, ChevronUp, Search, User, Clock, Camera, Briefcase, Trophy, TrendingUp } from 'lucide-react'
// AdminLogin modal replaced by unified sign-in in Settings → Account
import CountryPicker, { COUNTRIES, countryFlag, FlagImg } from './CountryPicker'

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

// ── Player stats from match history ──────────────────────────────────────────
function buildPlayerStats(playerId, matches, tournaments, registrations) {
  const completed = matches.filter(m => m.completed)
  const playerMatches = completed.filter(m =>
    (m.team1Ids || []).includes(playerId) || (m.team2Ids || []).includes(playerId)
  )

  let won = 0, lost = 0, draws = 0, pointsFor = 0, pointsAgainst = 0, points = 0
  const recentForm = [] // last 5: 'W' | 'L' | 'D'
  const h2h = {} // opponentId → { won, lost, draws }
  const h2hPairs = {} // "id1:id2" → { ids: [id1,id2], won, lost, draws }
  const tournamentIds = new Set()

  // Sort by tournament then round for chronological order
  const sorted = [...playerMatches].sort((a, b) =>
    a.tournamentId === b.tournamentId ? (a.round || 0) - (b.round || 0) : 0
  )

  sorted.forEach(m => {
    const s1 = parseInt(m.score1) || 0
    const s2 = parseInt(m.score2) || 0
    const onTeam1 = (m.team1Ids || []).includes(playerId)
    const myScore = onTeam1 ? s1 : s2
    const theirScore = onTeam1 ? s2 : s1
    const opponents = onTeam1 ? (m.team2Ids || []) : (m.team1Ids || [])

    pointsFor += myScore
    pointsAgainst += theirScore
    tournamentIds.add(m.tournamentId)

    points = pointsFor  // total game points scored
    let result
    if (myScore > theirScore) { won++; result = 'W' }
    else if (myScore < theirScore) { lost++; result = 'L' }
    else { draws++; result = 'D' }

    recentForm.push(result)

    opponents.forEach(oppId => {
      if (!h2h[oppId]) h2h[oppId] = { won: 0, lost: 0, draws: 0 }
      if (result === 'W') h2h[oppId].won++
      else if (result === 'L') h2h[oppId].lost++
      else h2h[oppId].draws++
    })

    // Track opponent pairs
    const pairKey = [...opponents].sort().join(':')
    if (pairKey) {
      if (!h2hPairs[pairKey]) h2hPairs[pairKey] = { ids: [...opponents].sort(), won: 0, lost: 0, draws: 0 }
      if (result === 'W') h2hPairs[pairKey].won++
      else if (result === 'L') h2hPairs[pairKey].lost++
      else h2hPairs[pairKey].draws++
    }
  })

  // Get tournaments this player participated in
  const playerTournaments = tournaments
    .filter(t => tournamentIds.has(t.id))
    .sort((a, b) => (b.date || '') > (a.date || '') ? 1 : -1)

  return {
    played: won + lost + draws,
    won, lost, draws, points,
    pointsFor, pointsAgainst,
    winRate: (won + lost + draws) > 0 ? Math.round((won / (won + lost + draws)) * 100) : 0,
    recentForm: recentForm.slice(-5),
    h2h,
    h2hPairs,
    playerTournaments,
  }
}

// Rotating fun prompts for the "notes" field shown at registration
const LOBBY_PROMPTS = [
  { label: '🎤 Trash Talk',        placeholder: 'Say something to your future opponents…' },
  { label: '🦞 Lobster Confession', placeholder: 'Confess your deepest padel sin…' },
  { label: '💬 War Cry',           placeholder: 'What do you scream before a match?' },
  { label: '🏅 Bold Claim',        placeholder: 'Make a promise you may not keep…' },
  { label: '🎯 Battle Cry',        placeholder: 'Inspire (or scare) your opponents…' },
  { label: '😤 Excuse Generator',  placeholder: 'Pre-write your excuse for losing today…' },
  { label: '🤝 Personal Pledge',   placeholder: 'What do you bring to the court?' },
  { label: '👀 Scouting Report',   placeholder: 'Describe your playing style in one line…' },
]
const randomPrompt = () => LOBBY_PROMPTS[Math.floor(Math.random() * LOBBY_PROMPTS.length)]

const emptyForm = {
  name: '', email: '', phone: '',
  playtomicLevel: '', adjustment: '0',
  playtomicUsername: '', notes: '', gender: '',
  isLeftHanded: false, country: '',
  avatarUrl: '', birthday: '',
  preferredPosition: '',
}

// Country data and picker imported from ./CountryPicker

// ── Corporate Performance Review generator ───────────────────────────────────
function corpReview(player, matches = [], registrations = [], tournaments = []) {
  const lvl  = player.adjustedLevel || 0
  const name = (player.name || 'Employee').split(' ')[0]
  const pid  = player.id

  const spid = String(pid)

  // ── Compute match stats ──────────────────────────────────────────────────
  const played = matches.filter(m =>
    m.completed && (
      m.team1Ids?.map(String).includes(spid) ||
      m.team2Ids?.map(String).includes(spid)
    )
  )
  let wins = 0, losses = 0
  played.forEach(m => {
    const onTeam1 = m.team1Ids?.map(String).includes(spid)
    const s1 = m.score1 ?? 0, s2 = m.score2 ?? 0
    if ((onTeam1 && s1 > s2) || (!onTeam1 && s2 > s1)) wins++
    else losses++
  })
  const totalMatches = wins + losses
  const winRate = totalMatches >= 1 ? wins / totalMatches : null

  // ── Compute tournament attendance ────────────────────────────────────────
  const today = new Date()
  const pastTournaments = tournaments.filter(t => t.status === 'completed' || new Date(t.date) <= today)
  const pastTournamentIds = new Set(pastTournaments.map(t => String(t.id)))

  const tournamentsPlayed = new Set(
    registrations
      .filter(r =>
        String(r.playerId) === spid &&
        r.status !== 'cancelled' &&
        pastTournamentIds.has(String(r.tournamentId))
      )
      .map(r => r.tournamentId)
  ).size
  const totalTournaments = pastTournaments.length

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
      const pos = ranked.findIndex(([id]) => String(id) === spid)
      if (pos >= 0) lastTournamentRank = pos + 1
    }
  }

  // ── No tournament history yet ────────────────────────────────────────────
  if (tournamentsPlayed === 0) {
    const welcome = [
      `${name} hasn't played a tournament yet — which means the group hasn't seen what they can do. That needs to change. Sign up. Show up. Make it a story worth telling.`,
      `No tournament history yet. Every legend in this group started exactly here. The only difference between then and now is one registration. ${name}, the courts are waiting.`,
      `${name} is yet to compete. The good news: nobody knows what to expect, which is the best possible position to be in. Sign up for the next one and make some noise.`,
      `Tournament debut pending. ${name} has everything ahead of them — no losses on record, no limits set, no one to prove wrong yet. The best time to start is the next tournament.`,
    ]
    const idHash = String(player.id || '0').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    return welcome[idHash % welcome.length]
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
  if (totalTournaments >= 2 && tournamentsPlayed >= totalTournaments) {
    return `Has attended every single tournament. Every. Single. One. Rain, wind, scheduling conflicts, life events — none of it mattered. We're not sure if this is dedication or if they simply have nowhere else to be. Both are valid.`
  }

  // The Ghost — barely shows up
  if (totalTournaments >= 2 && tournamentsPlayed <= 1) {
    return `Has appeared at approximately one tournament. Like a rare weather event — talked about, rarely witnessed. The group respects the mystery. Statistically, anything could happen next. Nobody knows. Not even ${name}.`
  }

  // Perfectly mediocre
  if (winRate !== null && winRate >= 0.45 && winRate <= 0.55 && totalMatches >= 4) {
    return `Win rate hovering in the 45–55% range across six or more matches. A statistical masterpiece. Not good enough to be intimidating, not bad enough to be endearing. Just perfectly, beautifully average. The bell curve's favourite child.`
  }

  // Has tournament history but no completed match data recorded
  if (tournamentsPlayed >= 1 && totalMatches === 0) {
    const noData = [
      `${name} has shown up to tournaments. The official match record, however, has chosen to remain silent on what actually happened out there. Either the results were never logged, or ${name} plays matches that exist on a different plane of reality. The committee is intrigued and has requested more data.`,
      `${name} has been on the court. The scorecards, however, appear to have been left behind. We know they played. We just can't prove anything. The committee is treating this as an open investigation.`,
      `Present at ${tournamentsPlayed} tournament${tournamentsPlayed > 1 ? 's' : ''}. Match data: classified. Whether by choice or by accident, ${name}'s results remain a mystery wrapped in a lobster shell. We respect the enigma.`,
    ]
    const idHash = String(player.id || '0').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    return noData[idHash % noData.length]
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

export default function Players({ onNavigate, focusPlayerId }) {
  const { players, addPlayer, updatePlayer, deletePlayer, isAdmin, claimedId, matches, registrations, tournaments, regeneratePin, fetchAllPlayersWithPii } = useApp()

  // ── Admin PII overlay ───────────────────────────────────────────────
  // After Phase 3 locks down players.email/phone/birthday from the anon
  // key, the `players` array we get from context (fed by players_public)
  // won't carry those fields. While admin is signed in we fetch the
  // full-PII rows via the admin-gated RPC and overlay them by id.
  const [piiById, setPiiById] = useState({})
  useEffect(() => {
    if (!isAdmin) { setPiiById({}); return }
    let cancelled = false
    ;(async () => {
      const rows = await fetchAllPlayersWithPii()
      if (cancelled || !rows) return
      const map = {}
      for (const r of rows) {
        map[r.id] = {
          email:    r.email    ?? '',
          phone:    r.phone    ?? '',
          birthday: r.birthday ?? '',
          notes:    r.notes    ?? '',
          pin:      r.pin      ?? '',
        }
      }
      setPiiById(map)
    })()
    return () => { cancelled = true }
  }, [isAdmin, fetchAllPlayersWithPii])

  // Merge a player record with the admin PII overlay. Non-admins get the
  // record unchanged (which means empty PII fields after Phase 3 — fine,
  // the admin-gated UI hides those fields anyway).
  const withPii = (p) => {
    if (!p) return p
    const extra = piiById[p.id]
    if (!extra) return p
    return {
      ...p,
      email:    extra.email    || p.email    || '',
      phone:    extra.phone    || p.phone    || '',
      birthday: extra.birthday || p.birthday || '',
      notes:    extra.notes    || p.notes    || '',
      pin:      extra.pin      || p.pin      || '',
    }
  }
  const [showForm, setShowForm]     = useState(false)
  const [editId, setEditId]         = useState(null)
  const [form, setForm]             = useState(emptyForm)
  const [lobbyPrompt, setLobbyPrompt] = useState(randomPrompt)
  const [search, setSearch]         = useState('')
  const [expandedId, setExpandedId] = useState(focusPlayerId || null)
  const focusRef = useRef(null)

  // Auto-scroll to focused player card
  useEffect(() => {
    if (focusPlayerId && focusRef.current) {
      setTimeout(() => {
        focusRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 150)
    }
  }, [focusPlayerId])
  const [saving, setSaving]         = useState(false)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [mergePlayer, setMergePlayer] = useState(null)   // existing player found by name
  const [pinReveal, setPinReveal]     = useState(null)   // { name, pin } — shown after registration
  const [linkModal, setLinkModal]     = useState(null)   // pending player being linked { pendingPlayer }
  const [linkSearch, setLinkSearch]   = useState('')     // search in link modal
  const fileInputRef = useRef(null)

  // Overlay admin PII onto every record up-front so downstream filtering,
  // rendering, and form-fill calls just see the merged object.
  const playersWithPii = useMemo(() => players.map(withPii), [players, piiById])
  const activePlayers  = playersWithPii.filter(p => (p.status || 'active') === 'active')
  const pendingPlayers = playersWithPii.filter(p => p.status === 'pending')

  const filtered = activePlayers.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  )
  const sorted = [...filtered].sort((a, b) => (b.adjustedLevel || 0) - (a.adjustedLevel || 0))

  // ── Name display: first name only; both players get a surname initial
  //    the moment a duplicate first name exists in the group ────────────────
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
    setForm(emptyForm); setEditId(null); setAvatarFile(null); setAvatarPreview(null); setMergePlayer(null)
    setLobbyPrompt(randomPrompt())
    setShowForm(true)
  }

  // Debounced duplicate check — fires 400ms after the user stops typing the name.
  // Reliable on both desktop and mobile (doesn't depend on onBlur).
  const mergeDebounceRef = useRef(null)
  useEffect(() => {
    if (editId) return  // never prompt when already editing
    clearTimeout(mergeDebounceRef.current)
    mergeDebounceRef.current = setTimeout(() => {
      const typed = form.name.trim().toLowerCase()
      if (typed.split(/\s+/).length < 2) { setMergePlayer(null); return }
      const found = players.find(p =>
        (p.name || '').trim().toLowerCase() === typed
      )
      setMergePlayer(found || null)
    }, 400)
    return () => clearTimeout(mergeDebounceRef.current)
  }, [form.name, editId])

  // Accept merge: pre-fill form with existing player data, switch to update mode
  const acceptMerge = () => {
    // Re-resolve through the PII-overlay so email/phone/birthday are
    // filled in if admin has fetched them.
    const p = withPii(mergePlayer)
    setForm({
      name: p.name || '',
      email: p.email || '',
      phone: p.phone || '',
      playtomicLevel: p.playtomicLevel ?? '',
      adjustment: p.adjustment ?? '0',
      playtomicUsername: p.playtomicUsername || '',
      notes: p.notes || '',
      gender: p.gender || '',
      isLeftHanded: p.isLeftHanded || false,
      country: p.country || '',
      avatarUrl: p.avatarUrl || '',
      birthday: p.birthday || '',
    })
    setAvatarPreview(p.avatarUrl || null)
    setEditId(p.id)
    setMergePlayer(null)
  }

  const openEdit = (p) => {
    if (!isAdmin) { onNavigate?.('settings'); return }
    setForm({
      name: p.name || '', email: p.email || '', phone: p.phone || '',
      playtomicLevel: p.playtomicLevel ?? '', adjustment: p.adjustment ?? '0',
      playtomicUsername: p.playtomicUsername || '', notes: p.notes || '',
      gender: p.gender || '', isLeftHanded: p.isLeftHanded || false,
      country: p.country || '',
      avatarUrl: p.avatarUrl || '',
      birthday: p.birthday || '',
      preferredPosition: p.preferredPosition || '',
    })
    setAvatarFile(null)
    setAvatarPreview(p.avatarUrl || null)
    setEditId(p.id); setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!isAdmin) { onNavigate?.('settings'); return }
    if (!confirm('Remove this player?')) return
    await deletePlayer(id)
  }

  const handleApprove = async (p) => {
    await updatePlayer(p.id, { ...p, status: 'active' })
    // Open WhatsApp with the PIN if we have a phone number
    if (p.phone) {
      const phone   = p.phone.replace(/\D/g, '')
      const name    = (p.name || '').split(' ')[0]
      const pin     = p.pin || '????'
      const message = `Hi ${name}! 🦞 You've been approved for Padel Lobsters. Your access PIN is *${pin}* — enter it once in the app to confirm your identity. See you on the court!`
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank')
    }
  }

  const handleReject = async (id) => {
    if (!confirm('Reject and remove this registration request?')) return
    await deletePlayer(id)
  }

  // Admin links a pending new joiner to an existing player profile:
  // copies their contact info onto the existing player, deletes the pending entry, sends existing PIN
  const handleLinkConfirm = async (existingPlayer) => {
    const pending = linkModal
    if (!pending || !existingPlayer) return

    // Merge: fill in any missing fields on the existing player from the pending registration
    const merged = {
      name:               existingPlayer.name,
      email:              existingPlayer.email              || pending.email              || '',
      phone:              existingPlayer.phone              || pending.phone              || '',
      country:            existingPlayer.country            || pending.country            || '',
      gender:             existingPlayer.gender             || pending.gender             || '',
      playtomicLevel:     existingPlayer.playtomicLevel     || pending.playtomicLevel     || 0,
      adjustment:         existingPlayer.adjustment         ?? pending.adjustment         ?? 0,
      playtomicUsername:  existingPlayer.playtomicUsername  || pending.playtomicUsername  || '',
      isLeftHanded:       existingPlayer.isLeftHanded       || pending.isLeftHanded       || false,
      avatarUrl:          existingPlayer.avatarUrl          || pending.avatarUrl          || '',
      notes:              existingPlayer.notes              || pending.notes              || '',
      status:             'active',
    }
    await updatePlayer(existingPlayer.id, merged)
    await deletePlayer(pending.id)
    setLinkModal(null)
    setLinkSearch('')

    // Send existing player's PIN to the new joiner's phone
    const phone = (pending.phone || existingPlayer.phone || '').replace(/\D/g, '')
    const firstName = existingPlayer.name.trim().split(/\s+/)[0]
    if (phone && existingPlayer.pin) {
      const msg = `Hi ${firstName}! 🦞 Your profile has been linked. Your Padel Lobsters PIN is *${existingPlayer.pin}* — enter it once in the app to verify your identity. See you on court!`
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
    }
  }

  const handleRegeneratePin = async (p) => {
    const newPin = await regeneratePin(p.id)
    if (p.phone) {
      const phone   = p.phone.replace(/\D/g, '')
      const name    = (p.name || '').split(' ')[0]
      const message = `Hi ${name}! 🦞 Your Padel Lobsters PIN has been reset. New PIN: *${newPin}*`
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank')
    }
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

    // Safety net: if a matching player exists and hasn't been merged yet, block submit
    if (!editId) {
      const typed = form.name.trim().toLowerCase()
      const duplicate = players.find(p => (p.name || '').trim().toLowerCase() === typed)
      if (duplicate) {
        // Force the merge banner to show — don't allow creating a duplicate
        setMergePlayer(duplicate)
        return
      }
    }

    // Validate all required fields before saving
    if (!isAdmin) {
      const missing = []
      if (!form.name.trim())          missing.push('Full Name')
      if (!form.country)              missing.push('Country')
      if (!form.gender)               missing.push('Gender')
      if (!form.email.trim())         missing.push('Email')
      if (!form.phone.trim())         missing.push('Phone / WhatsApp')
      if (!form.playtomicLevel)       missing.push('Playtomic Level')
      if (missing.length > 0) {
        alert(`Please complete the following fields before registering:\n\n• ${missing.join('\n• ')}`)
        return
      }
    }
    setSaving(true)
    try {
      let avatarUrl = form.avatarUrl || ''
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop()
        const filename = `player-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('avatars').upload(filename, avatarFile, { upsert: true })
        if (uploadError) {
          console.error('Avatar upload error:', uploadError)
          alert('Photo could not be saved: ' + uploadError.message + '\n\nMake sure the "avatars" storage bucket exists and is set to public in Supabase.')
        } else {
          const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filename)
          avatarUrl = publicUrl
        }
      }
      const isMerge = !!editId && !isAdmin
      const data = {
        ...form,
        avatarUrl,
        playtomicLevel: parseFloat(form.playtomicLevel) || 0,
        adjustment: parseFloat(form.adjustment) || 0,
        isLeftHanded: form.isLeftHanded || false,
        birthday: form.birthday || null,
        taglineLabel: lobbyPrompt.label,
        status: 'active',
      }
      const firstName = form.name.trim().split(/\s+/)[0]
      if (editId) {
        await updatePlayer(editId, data)
        if (!isAdmin) {
          const existing = players.find(p => String(p.id) === String(editId))
          if (existing?.pin) setPinReveal({ name: firstName, pin: existing.pin })
        }
      } else {
        const newPlayer = await addPlayer(data)
        if (newPlayer?.pin) {
          setPinReveal({ name: firstName, pin: newPlayer.pin })
        }
      }
      setShowForm(false)
      setAvatarFile(null); setAvatarPreview(null); setMergePlayer(null)
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
            <p className="text-sm font-bold text-orange-600">Waiting for approval ({pendingPlayers.length})</p>
          </div>
          {pendingPlayers.map(p => (
            <div key={p.id} className="card border-l-4 border-orange-300 space-y-2">
              <div className="flex items-center gap-3">
                <PlayerAvatar player={p} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{p.name}</p>
                  <p className="text-xs text-gray-500">
                    Lv {(p.adjustedLevel || 0).toFixed(1)}
                    {p.email && ` · ${p.email}`}
                  </p>
                </div>
                <button onClick={() => handleReject(p.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-red-50 active:scale-95 flex-shrink-0">
                  <X size={13} className="text-red-500" />
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleApprove(p)}
                  className="flex-1 text-xs bg-green-500 text-white px-3 py-2 rounded-xl font-semibold active:scale-95 transition-all">
                  ✓ Approve as new player
                </button>
                <button
                  onClick={() => { setLinkModal(p); setLinkSearch('') }}
                  className="flex-1 text-xs bg-lobster-teal text-white px-3 py-2 rounded-xl font-semibold active:scale-95 transition-all">
                  🔗 Played before?
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Link-to-existing modal */}
      {linkModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-md p-5 space-y-3 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-800">Link to existing player</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Who is <strong>{linkModal.name}</strong> in the system?
                </p>
              </div>
              <button onClick={() => { setLinkModal(null); setLinkSearch('') }}>
                <X size={22} className="text-gray-400" />
              </button>
            </div>

            <input
              type="text"
              placeholder="🔍 Search existing players…"
              value={linkSearch}
              onChange={e => setLinkSearch(e.target.value)}
              className="input"
              autoFocus
            />

            <div className="overflow-y-auto flex-1 space-y-2">
              {activePlayers
                .filter(p => p.name.toLowerCase().includes(linkSearch.toLowerCase()))
                .map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleLinkConfirm(p)}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl bg-gray-50 hover:bg-lobster-cream active:scale-[0.98] transition-all text-left"
                  >
                    <PlayerAvatar player={p} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-500">Lv {(p.adjustedLevel || 0).toFixed(1)}{p.email && ` · ${p.email}`}</p>
                    </div>
                  </button>
                ))}
            </div>

            <p className="text-xs text-gray-400 text-center pt-1">
              This will merge {linkModal.name}'s new contact info onto the existing profile and send them their PIN.
            </p>
          </div>
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
            <div key={p.id} ref={p.id === focusPlayerId ? focusRef : undefined} className="card transition-all">
              <div className="w-full" onClick={() => setExpandedId(expanded ? null : p.id)}>
                {/* Top row: rank · avatar · name · level · chevron */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-5 text-center flex-shrink-0">
                    #{idx + 1}
                  </span>
                  <PlayerAvatar player={p} />
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-semibold text-gray-800 truncate flex items-center gap-1.5">
                      {p.country && <FlagImg code={p.country} />}
                      {displayName(p)}
                      {p.isLeftHanded && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold ml-0.5">L</span>}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right flex flex-col items-end gap-1">
                    <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${levelBadge(p.adjustedLevel)}`}>
                      {(p.adjustedLevel || 0).toFixed(1)}
                    </span>
                    {isAdmin && p.pin && (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md tracking-wider">
                        {p.pin}
                      </span>
                    )}
                  </div>
                  {expanded
                    ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
                    : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
                </div>
                {/* Review — always visible */}
                <div className="mt-2 pl-8">
                  <p className="text-[10px] font-bold text-lobster-teal uppercase tracking-wider mb-0.5">Lobster Review</p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {corpReview(p, matches, registrations, tournaments)}
                  </p>
                </div>
              </div>

              {expanded && (() => {
                const stats = buildPlayerStats(p.id, matches, tournaments, registrations)
                const topH2HPairs = Object.values(stats.h2hPairs)
                  .map(rec => ({
                    names: rec.ids.map(id => (players.find(pl => pl.id === id)?.name || '').split(' ')[0]).filter(Boolean),
                    ...rec,
                  }))
                  .filter(h => h.names.length > 0)
                  .sort((a, b) => (b.won + b.lost + b.draws) - (a.won + a.lost + a.draws))
                  .slice(0, 5)

                return (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">

                  {/* Match record + tags row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {stats.played > 0 && (
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-lg font-semibold">
                        {stats.won}W {stats.lost}L · {stats.winRate}%
                      </span>
                    )}
                    {p.preferredPosition && (
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg font-semibold capitalize">
                        {p.preferredPosition === 'left' || p.preferredPosition === 'drive' ? '👈 Left' : p.preferredPosition === 'right' || p.preferredPosition === 'reves' ? '👉 Right' : '↔️ Both'}
                      </span>
                    )}
                    {p.isLeftHanded && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-lg font-semibold">🤚 Lefty</span>
                    )}
                    {p.birthday && (() => {
                      const [y, m, d] = p.birthday.split('-').map(Number)
                      const dt = new Date(y, m - 1, d)
                      const dayMonth = dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                      return <span className="text-xs text-gray-400">🎂 {dayMonth}</span>
                    })()}
                  </div>

                  {/* Level row — compact */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span>Playtomic {(p.playtomicLevel || 0).toFixed(1)}</span>
                    <span className={parseFloat(p.adjustment) >= 0 ? 'text-green-600' : 'text-red-500'}>
                      {parseFloat(p.adjustment) >= 0 ? '+' : ''}{p.adjustment || 0}
                    </span>
                    <span>→</span>
                    <span className={`font-bold px-1.5 py-0.5 rounded ${levelBadge(p.adjustedLevel)}`}>
                      {(p.adjustedLevel || 0).toFixed(1)}
                    </span>
                  </div>

                  {/* Recent form — last 5 matches */}
                  {stats.recentForm.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Last {stats.recentForm.length}</p>
                      <div className="flex gap-1">
                        {stats.recentForm.map((r, i) => (
                          <span key={i} className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                            r === 'W' ? 'bg-green-100 text-green-700' : r === 'L' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                          }`}>{r}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Head-to-head — top 5 opponent pairs */}
                  {topH2HPairs.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Head to Head</p>
                      <div className="space-y-1">
                        {topH2HPairs.map((h, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-gray-700 truncate max-w-[160px]">vs {h.names.join(' & ')}</span>
                            <span className="font-semibold">
                              <span className="text-green-600">{h.won}W</span>
                              {' '}<span className="text-red-500">{h.lost}L</span>
                              {h.draws > 0 && <> <span className="text-gray-400">{h.draws}D</span></>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tournament history — clickable */}
                  {stats.playerTournaments.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Tournaments</p>
                      <div className="flex flex-wrap gap-1.5">
                        {stats.playerTournaments.map(t => (
                          <button key={t.id}
                            onClick={(e) => { e.stopPropagation(); onNavigate && onNavigate('scores', t) }}
                            className="text-xs bg-lobster-cream text-lobster-teal px-2.5 py-1 rounded-lg font-semibold hover:bg-lobster-teal hover:text-white transition-all active:scale-95"
                          >
                            {t.name || new Date(t.date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Admin info */}
                  {isAdmin && (p.email || p.phone) && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Admin only</p>
                      {p.email && <p className="text-xs text-gray-500">✉ {p.email}</p>}
                      {p.phone && <p className="text-xs text-gray-500">📞 {p.phone}</p>}
                    </div>
                  )}
                  {/* Player tagline / notes with saved prompt label */}
                  {(p.tagline || p.notes) && (
                    <div className="bg-lobster-cream rounded-xl px-3 py-2">
                      <p className="text-[10px] font-bold text-lobster-teal uppercase tracking-wider mb-0.5">
                        {p.taglineLabel || p.tagline_label || '💬 War Cry'}
                      </p>
                      <p className="text-xs text-gray-700 italic">"{p.tagline || p.notes}"</p>
                    </div>
                  )}

                  {/* PIN — admin only */}
                  {isAdmin && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-0.5">Access PIN</p>
                        <p className="text-xl font-bold text-amber-800 tracking-widest">{p.pin || '—'}</p>
                      </div>
                      <button
                        onClick={() => handleRegeneratePin(p)}
                        className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-xl font-semibold active:scale-95 transition-all"
                      >
                        Reset & send
                      </button>
                    </div>
                  )}

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
                )
              })()}
            </div>
          )
        })}
      </div>

      {/* PIN reveal / pending confirmation modal */}
      {pinReveal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-5 text-center shadow-xl">
            <div className="text-5xl">🦞</div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Welcome, {pinReveal.name}!</h2>
              <p className="text-sm text-gray-500 mt-1">Here's your personal access PIN:</p>
            </div>

            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl py-5 px-4">
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-2">Your PIN</p>
              <p className="text-5xl font-bold text-amber-800 tracking-[0.35em]">{pinReveal.pin}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-left space-y-1.5">
              <p className="text-xs font-semibold text-gray-600">Save this PIN — you'll use it to:</p>
              <p className="text-xs text-gray-500">🦞 Post updates and react to messages</p>
              <p className="text-xs text-gray-500">📋 Confirm your identity in the app</p>
              <p className="text-xs text-gray-500">🔒 Keep your account secure</p>
            </div>
            <p className="text-[10px] text-gray-400">Ask the admin if you ever lose your PIN</p>

            <button onClick={() => setPinReveal(null)} className="btn-primary w-full">
              Got it, let's play! 🎾
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-md max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-800">{editId ? 'Edit Player' : 'Join the Lobsters 🦞'}</h2>
                {!editId && !isAdmin && (
                  <p className="text-xs text-gray-500 mt-0.5">You'll get an access PIN to use in the app</p>
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
                <label className="label">Full Name</label>
                <input required className="input" placeholder="e.g. Augustin Tapia" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              {/* Merge banner — shown for both admins and players when name already exists */}
              {mergePlayer && !editId && (
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🦞</span>
                    <div>
                      {isAdmin ? (
                        <>
                          <p className="font-semibold text-amber-800 text-sm">Player already exists!</p>
                          <p className="text-xs text-amber-700 mt-1">
                            <strong>{mergePlayer.name}</strong> is already in the system.
                            Update their existing profile instead of creating a duplicate?
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold text-amber-800 text-sm">Welcome back!</p>
                          <p className="text-xs text-amber-700 mt-1">
                            Your profile already exists — you've played in a past Lobster tournament.
                            Finish setting up your profile and we'll link everything together.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={acceptMerge}
                    className="w-full py-2.5 bg-amber-500 text-white rounded-xl font-semibold text-sm active:scale-95 transition-all">
                    {isAdmin ? `Update ${mergePlayer.name.split(' ')[0]}'s profile` : 'Yes, complete my profile'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMergePlayer(null)}
                    className="w-full py-2 text-amber-600 text-xs font-medium">
                    {isAdmin ? 'No, create as a new player' : "No, I'm a different person"}
                  </button>
                </div>
              )}

              <div>
                <label className="label">Country</label>
                <CountryPicker
                  value={form.country}
                  onChange={val => setForm(f => ({ ...f, country: val }))}
                />
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

              {/* Preferred position */}
              <div>
                <label className="label">Preferred Side</label>
                <div className="flex gap-2">
                  {[['left', '👈 Left'], ['right', '👉 Right'], ['both', '↔️ Both']].map(([val, lbl]) => (
                    <button type="button" key={val}
                      onClick={() => setForm(f => ({ ...f, preferredPosition: f.preferredPosition === val ? '' : val }))}
                      className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-all ${
                        form.preferredPosition === val ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                      {lbl}
                    </button>
                  ))}
                </div>
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
                <p className="text-xs text-gray-400 mt-1">Visible for organizers only</p>
              </div>

              <div>
                <label className="label">Phone / WhatsApp</label>
                <input type="tel" className="input" placeholder="+31 6 12345678" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                <p className="text-xs text-gray-400 mt-1">Visible for organizers only</p>
              </div>

              <div>
                <label className="label">Birthday 🎂</label>
                <input type="date" className="input" value={form.birthday || ''}
                  onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))} />
              </div>

              <div>
                <label className="label">{lobbyPrompt.label}</label>
                <textarea className="input resize-none" rows={2}
                  placeholder={lobbyPrompt.placeholder}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              <button type="submit" disabled={saving} className="btn-primary w-full">
                {saving ? 'Saving...' : editId ? 'Save Changes' : isAdmin ? 'Add Player' : 'Join the Lobsters 🦞'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
