import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../supabase'
import { Plus, X, Pencil, ShoppingBag, Gift, Shuffle, Upload, Check, ShoppingCart, User, GripVertical, Ban, Clock, Package, CreditCard, MessageSquare, LogIn } from 'lucide-react'
import { SignInBanner, useAuthPrompt } from './AuthGate'

const SIZES_APPAREL  = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const SIZES_SOCKS    = ['S (35-38)', 'M (39-42)', 'L (43-46)']
const SIZE_ORDER     = ['XS', 'S', 'S (35-38)', 'M', 'M (39-42)', 'L', 'L (43-46)', 'XL', 'XXL']
const sizeRank = (s) => { const i = SIZE_ORDER.indexOf(s); return i >= 0 ? i : 999 }

const STATUS_CONFIG = {
  ordered:   { label: 'Ordered',   icon: Clock,      bg: 'bg-amber-100',  text: 'text-amber-700' },
  paid:      { label: 'Paid',      icon: CreditCard,  bg: 'bg-green-100',  text: 'text-green-700' },
  delivered: { label: 'Delivered', icon: Package,     bg: 'bg-blue-100',   text: 'text-blue-700' },
  cancelled: { label: 'Cancelled', icon: Ban,         bg: 'bg-red-100',    text: 'text-red-500' },
}

const formatOrderTime = (ts) => {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

const getPlayerName = (o, players) => {
  if (!o || !o.player_id) return null
  // Try joined player name first
  if (o.players?.name) return o.players.name
  // Match from players list — compare as strings to avoid type mismatch
  const pid = String(o.player_id)
  const p = players.find(pl => String(pl.id) === pid)
  return p ? p.name : null
}

const emptyItem = {
  name: '', description: '', price: '', sizes: [], category: 'apparel', image_url: '', image_urls: [], active: true, external_orders: 0,
}

// ── Inline prize editor for a single winner row ───────────────────────────────
// Click the prize text to edit. Empty value shows a neutral placeholder so
// admin always knows the field exists. Save on blur or Enter; Esc reverts.
function PrizeEditor({ winner, onSave }) {
  const initial = winner.prize || ''
  const [editing, setEditing] = useState(false)
  const [value, setValue]     = useState(initial)
  useEffect(() => { setValue(initial) /* sync when winner changes */ }, [initial])
  const commit = async () => {
    setEditing(false)
    const trimmed = (value || '').trim()
    if (trimmed === (initial || '').trim()) return
    if (!winner.winnerId) return // not yet saved (RPC still in flight)
    await onSave(winner.winnerId, trimmed)
  }
  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); e.target.blur() }
          if (e.key === 'Escape') { setValue(initial); setEditing(false) }
        }}
        className="mt-1 px-2 py-1 rounded-md border border-amber-300 bg-white/80 text-amber-900 text-sm sm:text-base font-semibold w-full max-w-xs"
        placeholder="e.g. tshirt, hat, sticker"
      />
    )
  }
  return (
    <button onClick={() => setEditing(true)}
      className={`mt-1 text-sm sm:text-base font-semibold text-left ${winner.prize ? 'text-amber-900/80' : 'text-amber-900/40 italic'}`}>
      {winner.prize || '+ add prize'}
    </button>
  )
}

// ── Raffle component ──────────────────────────────────────────────────────────
function Raffle({ tournament, players, registrations }) {
  const { tournaments, raffleWinners, recordRaffleWinners, updateRaffleWinnerPrize } = useApp()

  const registered = (() => {
    const seen = new Set()
    const out = []
    registrations
      .filter(r => r.tournamentId === tournament?.id && r.status === 'registered')
      .forEach(r => {
        const p = players.find(pl => pl.id === r.playerId)
        if (!p) return
        const key = String(p.id)
        if (seen.has(key)) return // defensive: never list the same player twice in one draw
        seen.add(key)
        out.push(p)
      })
    return out
  })()

  // First-name labels with last-initial only for collisions; mirrors the
  // convention used in Game.jsx / Schedule.jsx so the projection screen
  // matches the rest of the app.
  const shortLabels = useMemo(() => {
    const firstOf = (p) => (p.name || '').trim().split(/\s+/)[0] || p.name || ''
    const lastOf  = (p) => {
      const parts = (p.name || '').trim().split(/\s+/)
      return parts.length > 1 ? parts.slice(1).join(' ') : ''
    }
    const byFirst = {}
    registered.forEach(p => {
      const f = firstOf(p).toLowerCase()
      ;(byFirst[f] ??= []).push(p)
    })
    const out = {}
    for (const key in byFirst) {
      const group = byFirst[key]
      if (group.length === 1) { out[String(group[0].id)] = firstOf(group[0]); continue }
      group.sort((a, b) => String(a.id).localeCompare(String(b.id)))
      let labels = null
      for (let len = 1; len <= 3; len++) {
        const candidate = group.map(p => {
          const last = lastOf(p)
          return last ? `${firstOf(p)} ${last.slice(0, len).toUpperCase()}` : firstOf(p)
        })
        if (new Set(candidate).size === candidate.length) { labels = candidate; break }
      }
      if (!labels) labels = group.map((p, i) => `${firstOf(p)} ${i + 1}`)
      group.forEach((p, i) => { out[String(p.id)] = labels[i] })
    }
    return out
  }, [registered])

  // localWins covers two failure modes:
  //   (1) a draw whose auto-save to DB hasn't round-tripped yet, and
  //   (2) network failure on auto-save — we still don't want the same
  //       person to come up twice in this tournament's raffle.
  const [localWins, setLocalWins] = useState([])
  // Reset when tournament changes.
  useEffect(() => { setLocalWins([]) }, [tournament?.id])

  // Set of player_ids who must be excluded for THIS tournament:
  //   - anyone with a saved raffle_winners row for this tournament_id
  //   - anyone the local session has already drawn for this tournament
  const alreadyWonHere = useMemo(() => {
    const s = new Set()
    if (tournament?.id) {
      const tId = String(tournament.id)
      ;(raffleWinners || []).forEach(w => {
        if (String(w.tournament_id) === tId) s.add(String(w.player_id))
      })
    }
    localWins.forEach(id => s.add(String(id)))
    return s
  }, [raffleWinners, tournament, localWins])

  // Eligibility: a registered player is INELIGIBLE if any of:
  //   a) they have NO prior registration in a tournament dated before
  //      this one (new-player rule),
  //   b) they're in cooldown — won in one of the last 2 raffles before
  //      this tournament,
  //   c) they have already been drawn for this tournament's raffle.
  const eligibility = useMemo(() => {
    const result = { eligible: [], ineligible: [] }
    if (!tournament?.date) {
      registered.forEach(p => result.eligible.push(p))
      return result
    }
    const tDate = tournament.date
    const tId = String(tournament.id)
    registered.forEach(p => {
      // Rule C — already won here this raffle.
      if (alreadyWonHere.has(String(p.id))) {
        result.ineligible.push({ player: p, reason: 'already_won_here' })
        return
      }
      // Rule A — new player. Three signals count as "veteran".
      const hasPriorReg = registrations.some(r =>
        String(r.playerId) === String(p.id) &&
        r.status === 'registered' &&
        String(r.tournamentId) !== tId &&
        (() => {
          const t = tournaments.find(tt => String(tt.id) === String(r.tournamentId))
          return t && t.date && t.date < tDate
        })()
      )
      if (!hasPriorReg) {
        result.ineligible.push({ player: p, reason: 'new_player' })
        return
      }
      // Rule B — cooldown (won in the last 2 raffles before this one).
      const myWins = (raffleWinners || []).filter(w => String(w.player_id) === String(p.id))
      const blockingWin = myWins.find(w => {
        if (!w.won_at_date) return false
        if (w.won_at_date >= tDate) return false  // future / current win doesn't bar current
        const between = tournaments.filter(t =>
          t && t.date && t.date > w.won_at_date && t.date < tDate
        ).length
        return (between + (w.cooldown_offset || 0)) < 2
      })
      if (blockingWin) {
        result.ineligible.push({ player: p, reason: 'cooldown', win: blockingWin })
        return
      }
      result.eligible.push(p)
    })
    return result
  }, [registered, registrations, tournaments, tournament, raffleWinners, alreadyWonHere])

  const [winners, setWinners]   = useState([])
  const [spinning, setSpinning] = useState(false)
  const [numPrizes, setNumPrizes] = useState(1)
  const [saved, setSaved]       = useState(false)

  // Is the selected tournament already in the past? Used to switch into
  // a read-only "review" mode (no Draw button, recorded winners are
  // pre-loaded).
  const isPastTournament = useMemo(() => {
    if (!tournament?.date) return false
    const d = new Date()
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return String(tournament.date) < todayStr
  }, [tournament?.date])

  // For past tournaments, populate the WINNERS card from the recorded
  // raffle_winners rows so admin can review (and edit prize labels).
  useEffect(() => {
    if (!tournament?.id) { setWinners([]); setSaved(false); return }
    if (!isPastTournament) return
    const rows = (raffleWinners || []).filter(w => String(w.tournament_id) === String(tournament.id))
    const enriched = rows.map(r => {
      const p = players.find(pl => String(pl.id) === String(r.player_id))
      return p ? { ...p, winnerId: r.id, prize: r.prize ?? null } : null
    }).filter(Boolean)
    setWinners(enriched)
    setSaved(true)
  }, [tournament?.id, isPastTournament, raffleWinners, players])

  const runRaffle = async () => {
    if (eligibility.eligible.length === 0) return
    setSpinning(true)
    setWinners([])
    setSaved(false)
    await new Promise(r => setTimeout(r, 800))
    const shuffled = [...eligibility.eligible].sort(() => Math.random() - 0.5)
    const picked = shuffled.slice(0, Math.min(numPrizes, eligibility.eligible.length))
    // Optimistic display — winnerId+prize get filled in once the auto-
    // record RPC returns.
    setWinners(picked.map(p => ({ ...p, winnerId: null, prize: null })))
    setSpinning(false)
    // Auto-record the win immediately so the cooldown is armed without
    // any extra click — and so a follow-up draw for the next prize never
    // re-picks someone who just won.
    setLocalWins(prev => [...prev, ...picked.map(p => p.id)])
    if (tournament?.id) {
      const rows = await recordRaffleWinners(tournament.id, picked.map(p => p.id))
      if (rows && rows.length > 0) {
        const byPid = Object.fromEntries(rows.map(r => [String(r.player_id), r]))
        setWinners(prev => prev.map(w => {
          const r = byPid[String(w.id)]
          return r ? { ...w, winnerId: r.id, prize: r.prize ?? null } : w
        }))
        setSaved(true)
      } else if (rows !== null) {
        // RPC returned [] — most likely all picks were dupes for this
        // tournament. Eligibility should have prevented that, but mark as
        // saved anyway so the badge state is honest.
        setSaved(true)
      }
    }
  }

  if (!tournament) return (
    <div className="card py-8 text-center text-gray-400">
      <Gift size={32} className="mx-auto mb-2 opacity-30" />
      <p className="text-sm">Open a tournament first to run a raffle</p>
    </div>
  )

  const eligibleCount = eligibility.eligible.length
  const ineligibleCount = eligibility.ineligible.length

  return (
    <div className="space-y-6">
      {/* Big raffle hero card — sized up so it reads from across the room
          when projected on a TV/screen during the tournament. The count
          and the draw both use the eligible pool only; ineligibility is
          deliberately not exposed to the projection. Hidden when the
          selected tournament is in the past — that switches into a
          read-only review of the recorded winners. */}
      {!isPastTournament && (
      <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-lobster-teal via-teal-600 to-teal-800 text-white shadow-2xl">
        <div className="flex items-center justify-center gap-3 mb-3">
          <Gift size={32} className="text-yellow-300" />
          <p className="text-2xl sm:text-3xl font-extrabold tracking-tight">Prize Raffle</p>
        </div>
        <p className="text-center text-white/80 text-sm sm:text-base mb-5">
          {tournament.name}
        </p>

        <div className="text-center mb-6">
          <p className="text-5xl sm:text-6xl font-black text-yellow-300 leading-none">
            {registered.length}
          </p>
          <p className="text-[11px] sm:text-xs uppercase tracking-widest text-white/70 mt-1">
            participants
          </p>
        </div>

        <div className="mb-5">
          <p className="text-sm text-white/80 mb-2 text-center font-semibold">
            How many prizes?
          </p>
          <div className="flex gap-2 justify-center">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setNumPrizes(n)}
                className={`flex-1 max-w-[64px] py-3 rounded-xl text-lg font-extrabold transition-all ${
                  numPrizes === n
                    ? 'bg-yellow-400 text-gray-900 scale-110 shadow-md'
                    : 'bg-white/15 text-white hover:bg-white/25'
                }`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={runRaffle}
          disabled={spinning || eligibleCount === 0}
          className="w-full bg-yellow-400 hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed text-gray-900 font-black text-lg sm:text-xl py-4 sm:py-5 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg"
        >
          <Shuffle size={22} className={spinning ? 'animate-spin' : ''} />
          {spinning ? 'Drawing winners…' : '🎲 Draw Winners!'}
        </button>

        {registered.length === 0 && (
          <p className="text-sm text-orange-200 text-center mt-3">No registered players yet</p>
        )}
      </div>
      )}

      {/* Winners — huge celebratory card for when the screen is showing
          the result to the whole room. */}
      {winners.length > 0 && (
        <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-yellow-300 via-amber-400 to-orange-400 shadow-2xl">
          <p className="font-black text-amber-900 text-3xl sm:text-4xl text-center mb-5 tracking-tight">
            🎉 WINNERS! 🎉
          </p>
          <div className="space-y-3">
            {winners.map((w, i) => (
              <div key={w.id} className="flex items-center gap-4 bg-white rounded-2xl p-4 sm:p-5 shadow-md">
                <span className="text-3xl sm:text-4xl flex-shrink-0">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                </span>
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-amber-400 flex items-center justify-center text-white font-bold text-xl sm:text-2xl flex-shrink-0">
                  {w.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-gray-800 text-xl sm:text-2xl md:text-3xl leading-tight truncate">
                    {shortLabels[String(w.id)] || (w.name || '').split(' ')[0] || w.name}
                  </p>
                  <PrizeEditor winner={w} onSave={updateRaffleWinnerPrize} />
                </div>
              </div>
            ))}
          </div>

          {/* Saved badge — auto-recorded on draw, so this is purely a
              confirmation. "Hide" only clears the local display; the
              winners stay saved in the DB. For past tournaments the
              saved state is implied so we just show a neutral header. */}
          {!isPastTournament && (
            <div className="mt-5 flex flex-col sm:flex-row gap-2">
              <div className={`flex-1 text-center font-bold py-3 rounded-xl flex items-center justify-center gap-2 ${
                  saved ? 'bg-white/60 text-amber-900' : 'bg-white/30 text-amber-900/60'
                }`}>
                <Check size={18} />
                {saved ? 'Saved' : 'Saving…'}
              </div>
              <button onClick={() => setWinners([])}
                className="text-sm text-amber-900/70 font-semibold py-3 px-4 hover:text-amber-900">
                Hide
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Image Lightbox ────────────────────────────────────────────────────────────
function Lightbox({ images, startIndex = 0, onClose }) {
  const [current, setCurrent] = useState(startIndex)
  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white"
      >
        <X size={20} />
      </button>

      {/* Main image */}
      <img
        src={images[current]}
        alt=""
        className="max-w-full max-h-[80vh] object-contain rounded-xl"
        onClick={e => e.stopPropagation()}
      />

      {/* Thumbnails if multiple */}
      {images.length > 1 && (
        <div className="flex gap-2 mt-4" onClick={e => e.stopPropagation()}>
          {images.map((url, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${i === current ? 'border-white' : 'border-transparent opacity-50'}`}
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Merch component ──────────────────────────────────────────────────────
export default function Merch({ tournament, tournaments: allTournaments = [], initialTab, onNavigate }) {
  const { players, registrations, isAdmin, tournaments: contextTournaments = [], claimedId, raffleWinners = [] } = useApp()
  const tournaments = allTournaments.length > 0 ? allTournaments : contextTournaments
  const [tab, setTab]             = useState(initialTab || 'shop')
  useEffect(() => { if (initialTab) setTab(initialTab) }, [initialTab])
  const [items, setItems]         = useState([])
  const [interests, setInterests] = useState([])
  const [loading, setLoading]     = useState(true)
  // Identity is managed in Settings → Account, but for friction-free ordering
  // we also pop a PIN prompt right where the player tapped.
  const { requireAuth, AuthPromptModal } = useAuthPrompt({ onNavigate })
  const goToSignIn = () => onNavigate?.('settings')
  const [showForm, setShowForm]   = useState(false)
  const [editItem, setEditItem]   = useState(null)
  const [form, setForm]           = useState(emptyItem)
  const [saving, setSaving]       = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedSize, setSelectedSize]   = useState({}) // itemId -> size
  const [sizeError, setSizeError]         = useState({}) // itemId -> true (missing size)
  const [customName, setCustomName]       = useState({}) // itemId -> name string
  const [ordered, setOrdered]             = useState({}) // itemId -> true (this session)
  const [selectedTournament, setSelectedTournament] = useState(tournament?.id != null ? String(tournament.id) : null)
  const [lightbox, setLightbox]           = useState(null) // { images, index }
  // Filter the prize/raffle picker to today's and future tournaments only.
  // Past events are hidden so the dropdown stays focused on what admin can
  // still act on. `today` is the user's local YYYY-MM-DD; tournament.date
  // strings are also YYYY-MM-DD so a string compare is sufficient.
  const upcomingTournaments = useMemo(() => {
    const d = new Date()
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const winsByTournament = new Set((raffleWinners || []).map(w => String(w.tournament_id)).filter(Boolean))
    // Include today + future as before, plus any past tournament that
    // already has recorded winners — admin can re-open it to review the
    // result. Pure-past-no-winners stays hidden.
    return tournaments.filter(t => {
      if (!t.date) return true
      if (String(t.date) >= todayStr) return true
      return winsByTournament.has(String(t.id))
    })
  }, [tournaments, raffleWinners])
  // If the currently selected tournament drops out of the upcoming window
  // (e.g. midnight rollover, or admin loaded the page with a stale prop),
  // clear it so the select widget doesn't render an orphan value.
  useEffect(() => {
    if (!selectedTournament) return
    if (!upcomingTournaments.find(t => String(t.id) === String(selectedTournament))) {
      setSelectedTournament(null)
    }
  }, [upcomingTournaments, selectedTournament])

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadItems = async () => {
    // Try ordering by display_order first; fall back to id if column doesn't exist yet
    let { data, error } = await supabase.from('merch_items').select('*').eq('active', true).order('display_order').order('id')
    if (error) {
      const res = await supabase.from('merch_items').select('*').eq('active', true).order('id')
      data = res.data
    }
    if (data) setItems(data)
    setLoading(false)
  }

  const loadInterests = async () => {
    // Always use simple select to avoid join issues
    const { data, error } = await supabase.from('merch_interests').select('*')
    if (error) {
      console.error('loadInterests failed:', error.message)
      return
    }
    console.log('loadInterests:', data?.length, 'orders loaded')
    if (data) setInterests(data)
  }

  useEffect(() => {
    loadItems()
    loadInterests()
    const ch1 = supabase.channel('merch-items').on('postgres_changes', { event: '*', schema: 'public', table: 'merch_items' }, loadItems).subscribe()
    const ch2 = supabase.channel('merch-interests').on('postgres_changes', { event: '*', schema: 'public', table: 'merch_interests' }, loadInterests).subscribe()
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2) }
  }, [])

  // ── Image upload (up to 3) ───────────────────────────────────────────────────
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const current = form.image_urls || []
    const slots   = 3 - current.length
    if (slots <= 0) return
    const toUpload = files.slice(0, slots)
    setUploading(true)
    try {
      const newUrls = []
      for (const file of toUpload) {
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name.replace(/\s/g, '_')}`
        const { error: uploadError } = await supabase.storage.from('merch').upload(filename, file, { upsert: true })
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage.from('merch').getPublicUrl(filename)
        newUrls.push(publicUrl)
      }
      setForm(f => ({
        ...f,
        image_urls: [...(f.image_urls || []), ...newUrls],
        image_url:  f.image_url || newUrls[0] || '',
      }))
    } catch (err) {
      alert('Image upload failed: ' + err.message + '\n\nMake sure a public "merch" storage bucket exists in Supabase with upload policies enabled.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleRemoveImage = (idx) => {
    setForm(f => {
      const next = (f.image_urls || []).filter((_, i) => i !== idx)
      return { ...f, image_urls: next, image_url: next[0] || '' }
    })
  }

  // ── Admin CRUD ───────────────────────────────────────────────────────────────
  const openAdd = () => {
    if (!isAdmin) { setShowLogin(true); return }
    setForm(emptyItem); setEditItem(null); setShowForm(true)
  }

  const openEdit = (item) => {
    if (!isAdmin) { setShowLogin(true); return }
    const urls = item.image_urls?.length ? item.image_urls : (item.image_url ? [item.image_url] : [])
    setForm({ ...item, price: String(item.price), sizes: item.sizes || [], image_urls: urls, external_orders: parseInt(item.external_orders) || 0 })
    setEditItem(item); setShowForm(true)
  }

  const handleSaveItem = async (e) => {
    e.preventDefault(); setSaving(true)
    const urls = form.image_urls || []
    const payload = {
      name: form.name,
      description: form.description || '',
      price: parseFloat(form.price) || 0,
      sizes: form.sizes || [],
      image_url: urls[0] || form.image_url || '',
      image_urls: urls,
      category: form.category || 'apparel',
      active: true,
      external_orders: Math.max(0, parseInt(form.external_orders) || 0),
    }
    if (editItem) {
      // Graceful fallback: if the external_orders column doesn't exist yet
      // (e.g. v15 migration not run), retry without it so admin can still
      // edit the rest of the item.
      let res = await supabase.from('merch_items').update(payload).eq('id', editItem.id)
      if (res.error) {
        const { external_orders: _drop, ...rest } = payload
        await supabase.from('merch_items').update(rest).eq('id', editItem.id)
      }
    } else {
      // New items go to the end of the list
      const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.display_order || 0)) : 0
      let res = await supabase.from('merch_items').insert({ ...payload, display_order: maxOrder + 1 })
      if (res.error) {
        const { external_orders: _drop, ...rest } = payload
        res = await supabase.from('merch_items').insert({ ...rest, display_order: maxOrder + 1 })
      }
      if (res.error) await supabase.from('merch_items').insert(payload)
    }
    await loadItems()
    setShowForm(false); setSaving(false)
  }

  const handleDeleteItem = async (id) => {
    if (!confirm('Remove this item?')) return
    await supabase.from('merch_items').update({ active: false }).eq('id', id)
    await loadItems()
  }

  // ── Drag-and-drop reorder (admin) ───────────────────────────────────────────
  const [dragIdx, setDragIdx] = useState(null)
  const [overIdx, setOverIdx] = useState(null)

  const handleDragStart = (idx) => (e) => {
    setDragIdx(idx)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (idx) => (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (idx !== overIdx) setOverIdx(idx)
  }

  const handleDrop = (idx) => async (e) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setOverIdx(null); return }
    const reordered = [...items]
    const [moved] = reordered.splice(dragIdx, 1)
    reordered.splice(idx, 0, moved)
    setItems(reordered)
    setDragIdx(null)
    setOverIdx(null)
    // Persist new order to DB
    const updates = reordered.map((item, i) =>
      supabase.from('merch_items').update({ display_order: i }).eq('id', item.id)
    )
    await Promise.all(updates)
  }

  const handleDragEnd = () => { setDragIdx(null); setOverIdx(null) }

  const toggleSize = (size) => {
    setForm(f => ({
      ...f,
      sizes: f.sizes.includes(size) ? f.sizes.filter(s => s !== size) : [...f.sizes, size]
    }))
  }

  // ── Orders ───────────────────────────────────────────────────────────────────
  // The counter combines live website orders (minus cancelled) with any
  // `external_orders` the admin recorded manually on the item — so players
  // see the real total (including offline/WhatsApp purchases). Cancelled
  // orders are excluded from the FOMO count.
  const websiteOrderCount = (itemId) =>
    interests.filter(i => i.merch_item_id === itemId && (i.status || 'ordered') !== 'cancelled').length
  const orderCount = (itemId) => {
    const item = items.find(i => i.id === itemId)
    const external = parseInt(item?.external_orders) || 0
    return websiteOrderCount(itemId) + external
  }

  const placeOrder = async (itemId) => {
    // If the player isn't signed in yet, pop the inline PIN prompt and
    // re-run the order on success — no navigation away from the shop.
    if (!claimedId) {
      requireAuth('player', () => placeOrder(itemId), {
        subtitle: 'Enter your PIN to place this order.',
      })
      return
    }

    // Verify the claimed identity still maps to a real player.
    const claimedPlayer = players.find(p => String(p.id) === String(claimedId))
    if (!claimedPlayer) {
      alert('Your session looks stale — please sign in again from Settings → Account.')
      goToSignIn()
      return
    }

    const item = items.find(i => i.id === itemId)
    const size = selectedSize[itemId] || ''
    const name = (customName[itemId] || '').trim()

    // Require size if item has sizes
    if (item?.sizes?.length > 0 && !size) {
      setSizeError(e => ({ ...e, [itemId]: true }))
      return
    }
    setSizeError(e => ({ ...e, [itemId]: false }))

    const pid = String(claimedPlayer.id)  // Store as text to handle both UUID and integer IDs

    // Check if player already ordered this item — update if so, insert if not
    const { data: existing } = await supabase
      .from('merch_interests')
      .select('id')
      .eq('player_id', pid)
      .eq('merch_item_id', itemId)
      .limit(1)

    let res
    if (existing && existing.length > 0) {
      // Update existing order — try with all fields, fall back gracefully
      res = await supabase.from('merch_interests')
        .update({ size, custom_name: name || '' })
        .eq('id', existing[0].id)
      if (res.error) {
        res = await supabase.from('merch_interests')
          .update({ size })
          .eq('id', existing[0].id)
      }
    } else {
      // Insert new order — try with all fields, then progressively strip optional columns
      const base = { merch_item_id: itemId, size, player_id: pid }
      res = await supabase.from('merch_interests').insert({ ...base, status: 'ordered', custom_name: name || '' })
      if (res.error) {
        res = await supabase.from('merch_interests').insert({ ...base, status: 'ordered' })
      }
      if (res.error) {
        res = await supabase.from('merch_interests').insert({ ...base, custom_name: name || '' })
      }
      if (res.error) {
        res = await supabase.from('merch_interests').insert(base)
      }
    }

    if (res.error) {
      console.error('Merch order failed:', res.error.message)
      alert('Order failed: ' + res.error.message)
      return
    }

    console.log('Order placed! claimedId:', claimedId, 'pid:', pid, 'itemId:', itemId)
    setOrdered(o => ({ ...o, [itemId]: true }))
    await loadInterests()
    console.log('After loadInterests, interests count:', interests.length)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  // Match orders to current player — try both string and number comparison
  const myPlayer = claimedId ? players.find(p => String(p.id) === String(claimedId)) : null
  const myOrders = myPlayer ? interests.filter(o => o.player_id === myPlayer.id || String(o.player_id) === String(myPlayer.id)) : []
  const activeOrders = interests.filter(o => (o.status || 'ordered') !== 'cancelled')

  // Cancel order modal state
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelComment, setCancelComment] = useState('')

  const TABS = [
    { id: 'shop', label: '🛍️ Shop' },
    ...(!isAdmin && myPlayer ? [{ id: 'myorders', label: `📦 My Orders${myOrders.length > 0 ? ` (${myOrders.length})` : ''}` }] : []),
    ...(isAdmin ? [{ id: 'orders', label: `📋 Orders${activeOrders.length > 0 ? ` (${activeOrders.length})` : ''}` }] : []),
    ...(isAdmin ? [{ id: 'prizes', label: '🎁 Prizes' }] : []),
    ...(isAdmin ? [{ id: 'manage', label: '⚙️ Manage' }] : []),
  ]

  return (
    <div className="space-y-4">
      <AuthPromptModal />
      {/* Identity is now handled entirely in Settings → Account. */}

      {/* Lightbox */}
      {lightbox && (
        <Lightbox
          images={lightbox.images}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}

      <h2 className="text-lg font-bold text-gray-800">Padel Lobsters Merch</h2>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${tab === t.id ? 'bg-white text-lobster-teal shadow-sm' : 'text-gray-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── SHOP TAB ── */}
      {tab === 'shop' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Place an order — the organizers will see what you need and get in touch. Prices include shipping.</p>

          {/* Identity notice — deep-links to Settings → Account */}
          {!claimedId && (
            <SignInBanner
              role="player"
              onNavigate={onNavigate}
              compact
              message="Sign in from Settings → Account before you can place orders."
            />
          )}

          {loading && <p className="text-center text-gray-400 py-8 text-sm">Loading…</p>}

          {items.map(item => {
            const allImgs = item.image_urls?.length > 0
              ? item.image_urls
              : item.image_url ? [item.image_url] : []
            return (
            <div key={item.id} className="card space-y-3">
              {/* Image(s) — tap to zoom */}
              {allImgs.length > 0 ? (
                <div
                  className="relative w-full bg-white rounded-xl overflow-hidden cursor-zoom-in"
                  onClick={() => setLightbox({ images: allImgs, index: 0 })}
                >
                  <img
                    src={allImgs[0]}
                    alt={item.name}
                    className="w-full h-52 object-contain rounded-xl"
                  />
                  {allImgs.length > 1 && (
                    <span className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                      +{allImgs.length - 1} more
                    </span>
                  )}
                  <span className="absolute bottom-2 left-2 bg-black/40 text-white text-xs px-2 py-0.5 rounded-full">
                    🔍 tap to zoom
                  </span>
                </div>
              ) : (
                <div className="w-full h-32 bg-lobster-cream rounded-xl flex items-center justify-center">
                  <ShoppingBag size={36} className="text-lobster-teal opacity-40" />
                </div>
              )}

              {/* Info */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-800">{item.name}</p>
                  {item.description && <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>}
                  {/* FOMO counter — combines website orders + offline sales.
                      Singular copy below 1, so "1 lobster has this" sounds
                      right when only one person has ordered so far. */}
                  {orderCount(item.id) > 0 && (
                    <p className="text-[11px] font-semibold text-amber-600 mt-1 flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                      {orderCount(item.id) === 1
                        ? '1 lobster already ordered 🦞'
                        : `${orderCount(item.id)} lobsters already ordered 🦞`}
                    </p>
                  )}
                </div>
                <span className="text-lg font-bold text-lobster-teal flex-shrink-0 ml-2">
                  €{parseFloat(item.price).toFixed(0)}
                  {(/shirt/i.test(item.name) && !/tank/i.test(item.name)) && (customName[item.id] || '').trim() && (
                    <span className="text-xs font-semibold text-amber-600 block text-right">+€5 name</span>
                  )}
                </span>
              </div>

              {/* Size picker */}
              {item.sizes?.length > 0 && (
                <div>
                  <p className={`text-xs mb-1.5 font-medium ${sizeError[item.id] ? 'text-red-500' : 'text-gray-500'}`}>
                    {sizeError[item.id] ? '⚠ Please select a size:' : 'Select size:'}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[...item.sizes].sort((a, b) => sizeRank(a) - sizeRank(b)).map(s => (
                      <button key={s}
                        onClick={() => {
                          setSelectedSize(si => ({ ...si, [item.id]: s }))
                          setSizeError(e => ({ ...e, [item.id]: false }))
                        }}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-all ${
                          selectedSize[item.id] === s
                            ? 'bg-lobster-teal text-white border-lobster-teal'
                            : sizeError[item.id]
                              ? 'border-red-300 text-gray-600'
                              : 'border-gray-200 text-gray-600'
                        }`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Name on item — only for shirts (+€5), not tank tops */}
              {(/shirt/i.test(item.name) && !/tank/i.test(item.name)) && (
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Name customization <span className="text-amber-600 font-semibold">(+€5)</span></label>
                  <input
                    type="text"
                    placeholder="e.g. Alex"
                    maxLength={30}
                    disabled={ordered[item.id]}
                    value={customName[item.id] || ''}
                    onChange={e => setCustomName(n => ({ ...n, [item.id]: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-lobster-teal focus:ring-1 focus:ring-lobster-teal transition-all disabled:opacity-40 disabled:bg-gray-50"
                  />
                </div>
              )}

              {/* Order button */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => placeOrder(item.id)}
                  disabled={ordered[item.id]}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                    ordered[item.id]
                      ? 'bg-green-100 text-green-700'
                      : 'bg-lobster-teal text-white active:scale-95'
                  }`}
                >
                  {ordered[item.id]
                    ? <><Check size={15} /> Ordered!</>
                    : <><ShoppingCart size={15} /> Order</>}
                </button>
                {isAdmin && orderCount(item.id) > 0 && (() => {
                  const web = websiteOrderCount(item.id)
                  const ext = parseInt(item.external_orders) || 0
                  return (
                    <span className="text-xs text-gray-400 flex-shrink-0" title="Website orders + offline orders">
                      {web}{ext > 0 ? ` + ${ext}` : ''} total
                    </span>
                  )
                })()}
              </div>
            </div>
          )})}

          {!loading && items.length === 0 && (
            <div className="card py-10 text-center text-gray-400">
              <ShoppingBag size={36} className="mx-auto mb-2 opacity-30" />
              <p>No merch items yet</p>
            </div>
          )}
        </div>
      )}

      {/* ── MY ORDERS TAB (player) ── */}
      {tab === 'myorders' && !isAdmin && claimedId && (
        <div className="space-y-3">
          {myOrders.length > 0 ? (
            myOrders
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
              .map(o => {
                const item = items.find(i => i.id === o.merch_item_id)
                const status = o.status || 'ordered'
                const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.ordered
                const StatusIcon = cfg.icon
                return (
                  <div key={o.id} className={`card space-y-2 ${status === 'cancelled' ? 'opacity-60' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                        {item?.image_url
                          ? <img src={item.image_url} className="w-full h-full object-cover" alt="" />
                          : <div className="w-full h-full flex items-center justify-center"><ShoppingBag size={18} className="text-gray-400" /></div>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800">{item?.name || 'Item'}</p>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          {o.size && <span className="text-xs font-bold bg-lobster-cream text-lobster-teal px-2 py-0.5 rounded-full">{o.size}</span>}
                          {(o.custom_name || '').trim() && <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium">Name: {o.custom_name}</span>}
                          <span className="text-[11px] text-gray-400">{formatOrderTime(o.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    {/* Status timeline */}
                    <div className="flex items-center gap-1 pt-1">
                      {['ordered', 'paid', 'delivered'].map((s, i) => {
                        const sCfg = STATUS_CONFIG[s]
                        const SIcon = sCfg.icon
                        const steps = ['ordered', 'paid', 'delivered']
                        const currentIdx = status === 'cancelled' ? -1 : steps.indexOf(status)
                        const active = steps.indexOf(s) <= currentIdx
                        return (
                          <React.Fragment key={s}>
                            {i > 0 && <div className={`flex-1 h-0.5 rounded ${active ? 'bg-lobster-teal' : 'bg-gray-200'}`} />}
                            <div className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full ${
                              active ? `${sCfg.bg} ${sCfg.text}` : 'bg-gray-100 text-gray-300'
                            }`}>
                              <SIcon size={10} /> {sCfg.label}
                            </div>
                          </React.Fragment>
                        )
                      })}
                    </div>
                    {/* Cancelled notice */}
                    {status === 'cancelled' && (
                      <div className="bg-red-50 rounded-xl p-2.5 space-y-1">
                        <p className="text-xs font-semibold text-red-500 flex items-center gap-1"><Ban size={11} /> Order cancelled by admin</p>
                        {o.admin_comment && <p className="text-xs text-red-400 italic">"{o.admin_comment}"</p>}
                      </div>
                    )}
                  </div>
                )
              })
          ) : (
            <div className="card py-8 text-center text-gray-400">
              <Package size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No orders yet — browse the Shop to get started</p>
            </div>
          )}
        </div>
      )}

      {/* ── PRIZES TAB (admin only) ── */}
      {tab === 'prizes' && isAdmin && (
        <div className="space-y-4">
          {/* Tournament selector — past tournaments are hidden so the
              prize/raffle picker only ever lists today's and future events. */}
          {upcomingTournaments.length === 0 ? (
            <div className="card text-center text-gray-400 py-4">
              <p className="text-sm">No upcoming tournaments</p>
            </div>
          ) : (
            <div className="card space-y-2">
              <label className="label">Select tournament for prizes & raffle</label>
              <select
                value={selectedTournament || ''}
                onChange={e => setSelectedTournament(e.target.value || null)}
                className="input text-sm"
              >
                <option value="">-- Choose tournament --</option>
                {upcomingTournaments.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Prize items for selected tournament — collapsed by default so the
              Raffle tile takes center stage on a projected screen. Admin can
              expand it when actually editing the prize pool. */}
          {selectedTournament && items.length > 0 && isAdmin && (() => {
            const selectedTour = tournaments.find(t => String(t.id) === String(selectedTournament))
            const prizeIds = selectedTour?.prizeItemIds || []
            return (
              <details className="bg-white border border-gray-100 rounded-xl text-sm">
                <summary className="cursor-pointer px-3 py-2 flex items-center gap-2 text-gray-600 hover:bg-gray-50 rounded-xl">
                  <ShoppingBag size={14} className="text-gray-400 flex-shrink-0" />
                  <span className="flex-1 truncate">
                    Prize pool: <span className="font-semibold text-gray-800">{prizeIds.length}</span> selected
                  </span>
                  <span className="text-[11px] text-gray-400">tap to edit</span>
                </summary>
                <div className="border-t border-gray-100 px-3 py-3 space-y-2">
                  <p className="text-[11px] text-gray-400">
                    Tap items to add / remove from the prize pool for {selectedTour?.name || 'this tournament'}
                  </p>
                  {items.map(item => {
                    const selected = prizeIds.includes(item.id)
                    return (
                      <div key={item.id}
                        onClick={() => {/* prize selection handled in context */}}
                        className={`flex items-center gap-3 p-2 rounded-xl border-2 transition-all ${selected ? 'border-lobster-teal bg-teal-50' : 'border-gray-100'}`}>
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                          {item.image_url
                            ? <img src={item.image_url} className="w-full h-full object-cover" alt="" />
                            : <div className="w-full h-full flex items-center justify-center"><ShoppingBag size={16} className="text-gray-400" /></div>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-800 truncate">{item.name}</p>
                          <p className="text-xs text-gray-500">€{parseFloat(item.price).toFixed(0)}</p>
                        </div>
                        {selected && <Check size={16} className="text-lobster-teal flex-shrink-0" />}
                      </div>
                    )
                  })}
                </div>
              </details>
            )
          })()}

          {/* Raffle — use selected tournament */}
          {selectedTournament && (
            <Raffle
              tournament={tournaments.find(t => String(t.id) === String(selectedTournament))}
              players={players}
              registrations={registrations}
            />
          )}

          {!selectedTournament && tournaments.length > 0 && (
            <div className="card py-8 text-center text-gray-400">
              <Gift size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Select a tournament above to manage prizes and run raffle</p>
            </div>
          )}
        </div>
      )}

      {/* ── ORDERS TAB (admin only) ── */}
      {tab === 'orders' && isAdmin && (
        <div className="space-y-4">
          {/* Cancel order modal */}
          {cancelTarget && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
              <div className="bg-white rounded-t-3xl w-full max-w-md p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-800">Cancel Order</h3>
                  <button onClick={() => { setCancelTarget(null); setCancelComment('') }}><X size={22} className="text-gray-400" /></button>
                </div>
                <p className="text-sm text-gray-500">
                  Cancel order for <strong>{getPlayerName(cancelTarget, players)?.split(' ')[0] || 'player'}</strong> — {items.find(i => i.id === cancelTarget.merch_item_id)?.name}?
                </p>
                <textarea
                  placeholder="Add a comment for the player (optional)…"
                  value={cancelComment}
                  onChange={e => setCancelComment(e.target.value)}
                  className="input text-sm w-full h-20 resize-none"
                />
                <button
                  onClick={async () => {
                    const { error } = await supabase.from('merch_interests').update({
                      status: 'cancelled',
                      admin_comment: cancelComment || null,
                      cancelled_at: new Date().toISOString(),
                      paid: false, delivered: false,
                    }).eq('id', cancelTarget.id)
                    if (error) {
                      // Fallback: try without status fields (pre-v12)
                      await supabase.from('merch_interests').update({
                        paid: false, delivered: false,
                      }).eq('id', cancelTarget.id)
                    }
                    setCancelTarget(null); setCancelComment('')
                    await loadInterests()
                  }}
                  className="w-full py-2.5 rounded-xl bg-red-500 text-white font-semibold text-sm active:scale-95 transition-all"
                >
                  Cancel Order
                </button>
              </div>
            </div>
          )}

          {activeOrders.length > 0 ? (
            <div className="space-y-2">
              {/* Summary stats */}
              <div className="flex gap-2 text-[11px] text-gray-500 px-1">
                <span>{activeOrders.length} orders</span>
                <span>·</span>
                <span className="text-amber-600">{activeOrders.filter(o => (o.status || 'ordered') === 'ordered').length} pending</span>
                <span>·</span>
                <span className="text-green-600">{activeOrders.filter(o => o.status === 'paid').length} paid</span>
                <span>·</span>
                <span className="text-blue-600">{activeOrders.filter(o => o.status === 'delivered').length} delivered</span>
              </div>

              {/* Order cards */}
              {[...activeOrders]
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .map(o => {
                  const playerName = getPlayerName(o, players)
                  const item = items.find(i => i.id === o.merch_item_id)
                  const status = o.status || 'ordered'
                  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.ordered
                  const StatusIcon = cfg.icon
                  const basePrice = item ? parseFloat(item.price) : 0
                  const hasCustomName = (o.custom_name || '').trim().length > 0
                  const isShirt = item && /shirt/i.test(item.name)
                  const orderPrice = basePrice + (isShirt && hasCustomName ? 5 : 0)
                  return (
                    <div key={o.id} className="card space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800">
                            {playerName?.split(' ')[0] || `Player #${o.player_id}`}
                            <span className="font-normal text-gray-500 ml-1.5 text-xs">{item?.name || '—'}</span>
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {o.size && <span className="text-xs font-bold bg-lobster-cream text-lobster-teal px-2 py-0.5 rounded-full">{o.size}</span>}
                            {hasCustomName && <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium">"{o.custom_name}"</span>}
                            <span className="text-xs font-bold text-lobster-teal">€{orderPrice}</span>
                            <span className="text-[11px] text-gray-400">{formatOrderTime(o.created_at)}</span>
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                          <StatusIcon size={10} /> {cfg.label}
                        </span>
                      </div>
                      {/* Status action buttons */}
                      <div className="flex gap-1.5">
                        <button
                          onClick={async () => {
                            await supabase.from('merch_interests').update({ status: 'paid', paid: true }).eq('id', o.id)
                            await loadInterests()
                          }}
                          disabled={status === 'paid' || status === 'delivered'}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            status === 'paid' || status === 'delivered'
                              ? 'bg-green-100 text-green-600'
                              : 'bg-gray-100 text-gray-500 active:scale-95'
                          }`}
                        >
                          {status === 'paid' || status === 'delivered' ? '✓ Paid' : 'Mark Paid'}
                        </button>
                        <button
                          onClick={async () => {
                            await supabase.from('merch_interests').update({ status: 'delivered', delivered: true }).eq('id', o.id)
                            await loadInterests()
                          }}
                          disabled={status === 'delivered'}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            status === 'delivered'
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-gray-100 text-gray-500 active:scale-95'
                          }`}
                        >
                          {status === 'delivered' ? '✓ Delivered' : 'Mark Delivered'}
                        </button>
                        <button
                          onClick={() => setCancelTarget(o)}
                          className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-400 active:scale-95 transition-all"
                        >
                          <Ban size={12} />
                        </button>
                      </div>
                    </div>
                  )
                })
              }

              {/* Cancelled orders (collapsed) */}
              {interests.filter(o => o.status === 'cancelled' && getPlayerName(o, players)).length > 0 && (
                <details className="mt-3">
                  <summary className="text-xs text-gray-400 cursor-pointer font-medium px-1">
                    {interests.filter(o => o.status === 'cancelled' && getPlayerName(o, players)).length} cancelled order{interests.filter(o => o.status === 'cancelled' && getPlayerName(o, players)).length > 1 ? 's' : ''}
                  </summary>
                  <div className="space-y-2 mt-2">
                    {interests.filter(o => o.status === 'cancelled' && getPlayerName(o, players)).map(o => {
                      const playerName = getPlayerName(o, players)
                      const item = items.find(i => i.id === o.merch_item_id)
                      return (
                        <div key={o.id} className="card opacity-60 space-y-1">
                          <p className="text-sm text-gray-500 line-through">
                            {playerName?.split(' ')[0] || 'Unknown'} — {item?.name} {o.size && `(${o.size})`}
                          </p>
                          {o.admin_comment && <p className="text-xs text-red-400 italic">"{o.admin_comment}"</p>}
                          <p className="text-[10px] text-gray-400">{formatOrderTime(o.cancelled_at || o.created_at)}</p>
                        </div>
                      )
                    })}
                  </div>
                </details>
              )}
            </div>
          ) : (
            <div className="card py-6 text-center text-gray-400 text-sm">No orders yet — orders will appear here when players place them from the Shop tab</div>
          )}
        </div>
      )}

      {/* ── MANAGE TAB (admin only) ── */}
      {tab === 'manage' && isAdmin && (
        <div className="space-y-4">
          <button onClick={openAdd} className="btn-primary w-full flex items-center justify-center gap-2">
            <Plus size={16} /> Add Merch Item
          </button>

          {/* Item list (draggable) */}
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div
                key={item.id}
                draggable
                onDragStart={handleDragStart(idx)}
                onDragOver={handleDragOver(idx)}
                onDrop={handleDrop(idx)}
                onDragEnd={handleDragEnd}
                className={`card flex items-center gap-3 transition-all ${
                  dragIdx === idx ? 'opacity-40 scale-[0.97]' : ''
                } ${overIdx === idx && dragIdx !== idx ? 'ring-2 ring-lobster-teal ring-offset-1' : ''}`}
              >
                <div className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0 text-gray-300 hover:text-gray-500 -ml-1">
                  <GripVertical size={18} />
                </div>
                <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                  {item.image_url
                    ? <img src={item.image_url} className="w-full h-full object-cover" alt="" draggable={false} />
                    : <div className="w-full h-full flex items-center justify-center"><ShoppingBag size={18} className="text-gray-400" /></div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{item.name}</p>
                  <p className="text-xs text-gray-500">€{parseFloat(item.price).toFixed(0)} · {orderCount(item.id)} {orderCount(item.id) === 1 ? 'order' : 'orders'}</p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => openEdit(item)} className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center">
                    <Pencil size={13} className="text-gray-500" />
                  </button>
                  <button onClick={() => handleDeleteItem(item.id)} className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                    <X size={13} className="text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ADD / EDIT form modal ── */}
      {showForm && isAdmin && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white rounded-t-3xl w-full max-w-md max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-800">{editItem ? 'Edit Item' : 'Add Merch Item'}</h2>
              <button onClick={() => setShowForm(false)}><X size={22} className="text-gray-400" /></button>
            </div>

            <form onSubmit={handleSaveItem} className="p-5 space-y-4">
              <div>
                <label className="label">Name *</label>
                <input required className="input" placeholder="e.g. Technical T-Shirt"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              <div>
                <label className="label">Description</label>
                <input className="input" placeholder="Short description"
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              <div>
                <label className="label">Price (€)</label>
                <input type="number" step="0.01" min="0" className="input" placeholder="0.00"
                  value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
              </div>

              {/* Offline orders — e.g. people who bought in person or via
                  WhatsApp. Added to the live website count in the shop
                  FOMO badge so players see the real demand. */}
              <div>
                <label className="label">Offline orders <span className="text-gray-400 font-normal">(bought outside the app)</span></label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="input"
                  placeholder="0"
                  value={form.external_orders ?? 0}
                  onChange={e => setForm(f => ({ ...f, external_orders: e.target.value }))}
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Counts toward the "X lobsters already ordered" badge players see in the shop.
                </p>
              </div>

              <div>
                <label className="label">Category</label>
                <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  <option value="apparel">Apparel</option>
                  <option value="accessories">Accessories</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Sizes */}
              <div>
                <label className="label">Sizes (select applicable)</label>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {SIZES_APPAREL.map(s => (
                      <button type="button" key={s} onClick={() => toggleSize(s)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-all ${form.sizes.includes(s) ? 'bg-lobster-teal text-white border-lobster-teal' : 'border-gray-200 text-gray-600'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SIZES_SOCKS.map(s => (
                      <button type="button" key={s} onClick={() => toggleSize(s)}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-all ${form.sizes.includes(s) ? 'bg-lobster-teal text-white border-lobster-teal' : 'border-gray-200 text-gray-600'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                  {form.sizes.length === 0 && <p className="text-xs text-gray-400">No sizes = one-size item</p>}
                </div>
              </div>

              {/* Images — up to 3 */}
              <div>
                <label className="label">Product Photos <span className="text-gray-400 font-normal">(up to 3)</span></label>

                {/* Thumbnails row */}
                {(form.image_urls || []).length > 0 && (
                  <div className="flex gap-2 mb-3">
                    {(form.image_urls || []).map((url, idx) => (
                      <div key={idx} className="relative w-24 h-24 flex-shrink-0">
                        <img src={url} alt="" className="w-full h-full object-cover rounded-xl border border-gray-200" />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold leading-none"
                        >×</button>
                        {idx === 0 && (
                          <span className="absolute bottom-1 left-1 text-[9px] bg-black/50 text-white px-1 rounded">main</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload button — only show if under 3 */}
                {(form.image_urls || []).length < 3 && (
                  <label className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 font-medium cursor-pointer transition-all hover:border-lobster-teal hover:text-lobster-teal ${uploading ? 'opacity-50' : ''}`}>
                    <Upload size={16} />
                    {uploading ? 'Uploading…' : `Add photo${(form.image_urls || []).length > 0 ? ` (${(form.image_urls || []).length}/3)` : ''}`}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      disabled={uploading}
                      onChange={handleImageUpload}
                    />
                  </label>
                )}
              </div>

              <button type="submit" disabled={saving || uploading} className="btn-primary w-full">
                {saving ? 'Saving…' : editItem ? 'Save Changes' : 'Add Item'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
