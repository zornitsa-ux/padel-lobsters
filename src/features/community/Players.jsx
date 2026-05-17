import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import usePlayerAliases from '../../hooks/usePlayerAliases'
import { supabase } from '../../supabase'
import { ChevronDown, ChevronUp, Search, User, GitMerge, RotateCcw } from 'lucide-react'
import { FlagImg } from '../../components/ui/CountryPicker'
import PlayerAliasMatcher from '../../components/PlayerAliasMatcher'
import { processAvatar } from '../../lib/processAvatar'
import Avatar from '../../components/ui/Avatar'
import { LEVEL_COLORS, randomPrompt, emptyForm } from './playerConstants'
import { REVIEW_SCENARIOS, corpReview } from './reviewScenarios'
import PlayerProfileDrawer from './PlayerProfileDrawer'
import PlayerForm from './PlayerForm'
import ReviewBreakdownModal from './ReviewBreakdownModal'
import LinkPlayerModal from './LinkPlayerModal'
import PinRevealModal from './PinRevealModal'
import PendingApprovalsList from './PendingApprovalsList'

export default function Players({ onNavigate, focusPlayerId }) {
  const {
    players,
    addPlayer,
    updatePlayer,
    deletePlayer,
    session,
    matches,
    registrations,
    tournaments,
    regeneratePin,
    fetchAllPlayersWithPii,
  } = useApp()
  const { playerAliases, setPlayerAlias, removePlayerAlias } = usePlayerAliases()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const claimedId = session?.user?.id ?? null

  // ── Admin PII overlay ───────────────────────────────────────────────
  // After Phase 3 locks down players.email/phone/birthday from the anon
  // key, the `players` array we get from context (fed by players_public)
  // won't carry those fields. While admin is signed in we fetch the
  // full-PII rows via the admin-gated RPC and overlay them by id.
  const [piiById, setPiiById] = useState({})
  useEffect(() => {
    if (!isAdmin) {
      setPiiById({})
      return
    }
    let cancelled = false
    ;(async () => {
      const rows = await fetchAllPlayersWithPii()
      if (cancelled || !rows) return
      const map = {}
      for (const r of rows) {
        map[r.id] = {
          email: r.email ?? '',
          phone: r.phone ?? '',
          birthday: r.birthday ?? '',
          notes: r.notes ?? '',
          pin: r.pin ?? '',
          pin_changes: r.pin_changes ?? 0,
          pinChanges: r.pin_changes ?? 0,
        }
      }
      setPiiById(map)
    })()
    return () => {
      cancelled = true
    }
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
      email: extra.email || p.email || '',
      phone: extra.phone || p.phone || '',
      birthday: extra.birthday || p.birthday || '',
      notes: extra.notes || p.notes || '',
      pin: extra.pin || p.pin || '',
    }
  }
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [lobbyPrompt, setLobbyPrompt] = useState(randomPrompt)
  const [search, setSearch] = useState('')
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
  const [saving, setSaving] = useState(false)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [mergePlayer, setMergePlayer] = useState(null) // existing player found by name
  const [pinReveal, setPinReveal] = useState(null) // { name, pin } — shown after registration
  const [linkModal, setLinkModal] = useState(null) // pending player being linked { pendingPlayer }
  const [linkSearch, setLinkSearch] = useState('') // search in link modal
  const [showAliasMatcher, setShowAliasMatcher] = useState(false) // admin: tag historical names → players
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  // Overlay admin PII onto every record up-front so downstream filtering,
  // rendering, and form-fill calls just see the merged object.
  const playersWithPii = useMemo(() => players.map(withPii), [players, piiById])
  const activePlayers = playersWithPii.filter((p) => (p.status || 'active') === 'active')
  const pendingPlayers = playersWithPii.filter((p) => p.status === 'pending')

  const filtered = activePlayers.filter((p) => p.name?.toLowerCase().includes(search.toLowerCase()))
  // Chronological order — first to join is #1, newest joiner is last.
  // Falls back to id ordering if created_at is missing on a record.
  const sorted = [...filtered].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0
    if (ta !== tb) return ta - tb
    return String(a.id).localeCompare(String(b.id))
  })

  // Pin the logged-in player's card to the top when no search is active.
  // During search the self card just shows up via the regular filtered
  // list (or disappears entirely if their name doesn't match the query).
  // The original chronological index (`idx`) is preserved on the pair so
  // the rank badge `#${idx + 1}` keeps reflecting join order, not the
  // display position.
  const orderedForRender = (() => {
    const withIdx = sorted.map((p, idx) => ({ p, idx, isSelf: false }))
    if (search.trim()) return withIdx
    const cid = claimedId ? String(claimedId) : null
    if (!cid) return withIdx
    const selfPos = withIdx.findIndex((x) => String(x.p.id) === cid)
    if (selfPos === -1) return withIdx
    const selfPair = { ...withIdx[selfPos], isSelf: true }
    const rest = withIdx.filter((_, i) => i !== selfPos)
    return [selfPair, ...rest]
  })()

  // ── Review breakdown ─────────────────────────────────────────────────────
  // Run corpReview for every active player so we can group them by which
  // scenario fired. Drives both the header counter and the admin-only
  // breakdown panel that lists each scenario with its message + matched
  // players. Recomputes whenever the underlying data changes.
  const reviewBreakdown = useMemo(() => {
    const byScenario = new Map()
    REVIEW_SCENARIOS.forEach((s) => {
      byScenario.set(s.id, { id: s.id, label: s.label, players: [], samples: new Map() })
    })
    activePlayers.forEach((p) => {
      const r = corpReview(p, matches, registrations, tournaments, playerAliases)
      let bucket = byScenario.get(r.scenario)
      if (!bucket) {
        bucket = { id: r.scenario, label: r.scenarioLabel, players: [], samples: new Map() }
        byScenario.set(r.scenario, bucket)
      }
      bucket.players.push({ id: p.id, name: p.name })
      // De-dupe identical message variants so we can show how many flavours
      // of the same scenario are actually in play.
      const v = bucket.samples.get(r.text)
      if (v) v.count++
      else bucket.samples.set(r.text, { text: r.text, count: 1 })
    })
    return [...byScenario.values()]
      .filter((b) => b.players.length > 0)
      .sort((a, b) => b.players.length - a.players.length)
  }, [activePlayers, matches, registrations, tournaments, playerAliases])

  // A scenario is "generic" if it's the level-based fallback or the welcome
  // line — everything else is personalised by tournament/match data.
  const GENERIC_IDS = new Set(['level-low', 'level-mid', 'level-high', 'level-elite', 'welcome'])
  const genericCount = reviewBreakdown
    .filter((b) => GENERIC_IDS.has(b.id))
    .reduce((n, b) => n + b.players.length, 0)
  const personalisedCount = activePlayers.length - genericCount

  const [showReviewBreakdown, setShowReviewBreakdown] = useState(false)

  // ── Name display: first name only; both players get a surname initial
  //    the moment a duplicate first name exists in the group ────────────────
  const firstNameCount = {}
  activePlayers.forEach((p) => {
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
    setForm(emptyForm)
    setEditId(null)
    setAvatarFile(null)
    setAvatarPreview(null)
    setMergePlayer(null)
    setLobbyPrompt(randomPrompt())
    setShowForm(true)
  }

  // Debounced duplicate check — fires 400ms after the user stops typing the name.
  // Reliable on both desktop and mobile (doesn't depend on onBlur).
  const mergeDebounceRef = useRef(null)
  useEffect(() => {
    if (editId) return // never prompt when already editing
    clearTimeout(mergeDebounceRef.current)
    mergeDebounceRef.current = setTimeout(() => {
      const typed = form.name.trim().toLowerCase()
      if (typed.split(/\s+/).length < 2) {
        setMergePlayer(null)
        return
      }
      const found = players.find((p) => (p.name || '').trim().toLowerCase() === typed)
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
    if (!isAdmin) {
      onNavigate?.('settings')
      return
    }
    // Split existing single-string name into first + last so the new two-field
    // form populates correctly. Single-word names go entirely into firstName
    // (with an empty lastName) — admin can fill in the surname when they
    // edit the player.
    const nameParts = (p.name || '').trim().split(/\s+/)
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ')
    setForm({
      firstName,
      lastName,
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
      preferredPosition: p.preferredPosition || '',
    })
    setAvatarFile(null)
    setAvatarPreview(p.avatarUrl || null)
    setEditId(p.id)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!isAdmin) {
      onNavigate?.('settings')
      return
    }
    if (!confirm('Remove this player?')) return
    setError('')
    try {
      await deletePlayer(id)
    } catch (err) {
      setError(err?.message || 'Could not remove player.')
    }
  }

  const handleApprove = async (p) => {
    setError('')
    try {
      await updatePlayer(p.id, { ...p, status: 'active' })
      // Phase 2d: PIN was already emailed at signup; no need to share via
      // WhatsApp on approval. If the player lost their PIN, they use
      // "Forgot PIN?" on the sign-in screen for self-service recovery.
    } catch (err) {
      setError(err?.message || 'Could not approve player.')
    }
  }

  const handleReject = async (id) => {
    if (!confirm('Reject and remove this registration request?')) return
    setError('')
    try {
      await deletePlayer(id)
    } catch (err) {
      setError(err?.message || 'Could not reject player.')
    }
  }

  // Admin links a pending new joiner to an existing player profile:
  // copies their contact info onto the existing player, deletes the pending entry, sends existing PIN
  const handleLinkConfirm = async (existingPlayer) => {
    const pending = linkModal
    if (!pending || !existingPlayer) return

    // Merge: fill in any missing fields on the existing player from the pending registration
    const merged = {
      name: existingPlayer.name,
      email: existingPlayer.email || pending.email || '',
      phone: existingPlayer.phone || pending.phone || '',
      country: existingPlayer.country || pending.country || '',
      gender: existingPlayer.gender || pending.gender || '',
      playtomicLevel: existingPlayer.playtomicLevel || pending.playtomicLevel || 0,
      adjustment: existingPlayer.adjustment ?? pending.adjustment ?? 0,
      playtomicUsername: existingPlayer.playtomicUsername || pending.playtomicUsername || '',
      isLeftHanded: existingPlayer.isLeftHanded || pending.isLeftHanded || false,
      avatarUrl: existingPlayer.avatarUrl || pending.avatarUrl || '',
      notes: existingPlayer.notes || pending.notes || '',
      status: 'active',
    }
    setError('')
    try {
      await updatePlayer(existingPlayer.id, merged)
      await deletePlayer(pending.id)
      setLinkModal(null)
      setLinkSearch('')
    } catch (err) {
      setError(err?.message || 'Could not link player.')
    }
    // Phase 2d: linked profiles already had a PIN. If the player can't
    // recall it, "Forgot PIN?" on the sign-in screen sends a fresh one
    // to their email. Admin no longer needs to share via WhatsApp.
  }

  const handleRegeneratePin = async (p) => {
    // Phase 2d: admin_regenerate_pin RPC also calls send_pin_email, so
    // the new PIN is emailed automatically. We surface the new PIN in a
    // modal (no alert) — useful when the email is bouncing or admin needs
    // to read it back to the player on the spot.
    setError('')
    try {
      const result = await regeneratePin(p.id)
      if (result?.ok && result.pin) {
        const firstName = (p.name || '').split(' ')[0] || 'Player'
        setPinReveal({ name: firstName, pin: result.pin })
      }
    } catch (err) {
      setError(err?.message || 'Could not regenerate PIN.')
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

    // First + Last are required on every registration (new or self-edit).
    // Combine them back into `name` so everything downstream (schedule,
    // leaderboards, messaging) keeps working unchanged.
    const firstName = (form.firstName || '').trim()
    const lastName = (form.lastName || '').trim()
    const combinedName = [firstName, lastName].filter(Boolean).join(' ')

    // Safety net: if a matching player exists and hasn't been merged yet, block submit
    if (!editId) {
      const typed = combinedName.toLowerCase()
      const duplicate = players.find((p) => (p.name || '').trim().toLowerCase() === typed)
      if (duplicate) {
        // Force the merge banner to show — don't allow creating a duplicate
        setMergePlayer(duplicate)
        return
      }
    }

    // Validate all required fields before saving. Admins see a lighter
    // check (they can create placeholder entries); self-registering players
    // must fill everything including first + last name.
    const missing = []
    if (!firstName) missing.push('First Name')
    if (!lastName) missing.push('Last Name')
    if (!isAdmin) {
      if (!form.country) missing.push('Country')
      if (!form.gender) missing.push('Gender')
      if (!form.email.trim()) missing.push('Email')
      if (!form.phone.trim()) missing.push('Phone / WhatsApp')
      if (!form.playtomicLevel) missing.push('Playtomic Level')
    }
    if (missing.length > 0) {
      alert(`Please complete the following fields before registering:\n\n• ${missing.join('\n• ')}`)
      return
    }
    setSaving(true)
    setError('')
    try {
      let avatarUrl = form.avatarUrl || ''
      if (avatarFile) {
        let processed
        try {
          processed = await processAvatar(avatarFile)
        } catch (err) {
          console.error('Avatar processing error:', err)
          alert('Photo could not be processed: ' + err.message)
          setSaving(false)
          return
        }
        const filename = `player-${Date.now()}-${Math.random().toString(36).slice(2)}.webp`
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filename, processed, { upsert: true, contentType: 'image/webp' })
        if (uploadError) {
          console.error('Avatar upload error:', uploadError)
          alert(
            'Photo could not be saved: ' +
              uploadError.message +
              '\n\nMake sure the "avatars" storage bucket exists and is set to public in Supabase.',
          )
        } else {
          const {
            data: { publicUrl },
          } = supabase.storage.from('avatars').getPublicUrl(filename)
          avatarUrl = publicUrl
        }
      }
      const isMerge = !!editId && !isAdmin
      const data = {
        ...form,
        name: combinedName, // overwrite whatever was on form.name — single source of truth
        avatarUrl,
        playtomicLevel: parseFloat(form.playtomicLevel) || 0,
        adjustment: parseFloat(form.adjustment) || 0,
        isLeftHanded: form.isLeftHanded || false,
        birthday: form.birthday || null,
        taglineLabel: lobbyPrompt.label,
        status: 'active',
      }
      // Drop the transient firstName / lastName fields — the DB only knows
      // about `name`. Keeping them in the payload would let the API tolerate
      // unknown columns (currently fine) but it's cleaner to be explicit.
      delete data.firstName
      delete data.lastName
      try {
        if (editId) {
          await updatePlayer(editId, data)
          if (!isAdmin) {
            const existing = players.find((p) => String(p.id) === String(editId))
            if (existing?.pin) setPinReveal({ name: firstName, pin: existing.pin })
          }
        } else {
          const result = await addPlayer(data)
          // addPlayer now returns { ok, data: insertedRow } — pin lives on result.data.
          const insertedPin = result?.data?.pin
          if (insertedPin) {
            setPinReveal({ name: firstName, pin: insertedPin })
          }
        }
        setShowForm(false)
        setAvatarFile(null)
        setAvatarPreview(null)
        setMergePlayer(null)
      } catch (err) {
        setError(err?.message || 'Could not save player.')
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
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-2 flex items-start justify-between gap-2">
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            className="text-red-500 font-bold leading-none px-1"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}
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
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowAliasMatcher(true)}
              className="text-xs font-semibold text-lobster-teal border border-lobster-teal/30 bg-lobster-cream px-3 py-2 rounded-xl flex items-center gap-1.5 active:scale-95 transition-all"
              title="Tag historical names from past tournaments to current players"
            >
              <GitMerge size={14} /> Match history
            </button>
          )}
          {/* "Join" button removed — new-player signup now lives exclusively
              on the home page via the sign-in / sign-up popup
              (VerificationGate → SignupRequest). The in-app Players roster
              stays focused on viewing / editing existing members. */}
        </div>
      </div>

      {/* Personalised-profile counter — only shown to admins so it doesn't
          clutter the public view. Helps gauge how many reviews are running
          on real data vs. the generic level-based fallback. */}
      {isAdmin && activePlayers.length > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] -mt-2 flex-wrap">
          <span className="bg-teal-50 text-teal-700 font-semibold px-2 py-0.5 rounded-full">
            ✦ {personalisedCount} personalised
          </span>
          <span className="bg-gray-100 text-gray-500 font-semibold px-2 py-0.5 rounded-full">
            {genericCount} generic
          </span>
          <span className="text-gray-400">
            {activePlayers.length > 0
              ? Math.round((personalisedCount / activePlayers.length) * 100)
              : 0}
            % Lobster Reviews use real tournament data
          </span>
          <button
            onClick={() => setShowReviewBreakdown(true)}
            className="ml-auto text-lobster-teal font-semibold underline-offset-2 hover:underline"
          >
            View breakdown →
          </button>
        </div>
      )}

      {/* Admin-only Review Breakdown modal */}
      {showReviewBreakdown && (
        <ReviewBreakdownModal
          reviewBreakdown={reviewBreakdown}
          onClose={() => setShowReviewBreakdown(false)}
        />
      )}

      {/* Historical-name matcher (admin) */}
      {showAliasMatcher && (
        <PlayerAliasMatcher
          players={players}
          playerAliases={playerAliases}
          setPlayerAlias={setPlayerAlias}
          removePlayerAlias={removePlayerAlias}
          onClose={() => setShowAliasMatcher(false)}
        />
      )}

      {/* Pending approvals */}
      {isAdmin && (
        <PendingApprovalsList
          pendingPlayers={pendingPlayers}
          onApprove={handleApprove}
          onReject={handleReject}
          onLink={(p) => {
            setLinkModal(p)
            setLinkSearch('')
          }}
        />
      )}

      {/* Link-to-existing modal */}
      <LinkPlayerModal
        linkModal={linkModal}
        linkSearch={linkSearch}
        setLinkSearch={setLinkSearch}
        activePlayers={activePlayers}
        onClose={() => {
          setLinkModal(null)
          setLinkSearch('')
        }}
        onConfirm={handleLinkConfirm}
      />

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="Search players..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Player list */}
      <div className="space-y-2">
        {sorted.length === 0 && (
          <div className="card py-10 text-center text-gray-400">
            <User size={36} className="mx-auto mb-2 opacity-30" />
            <p>No players yet. Be the first to join!</p>
          </div>
        )}

        {orderedForRender.map(({ p, idx, isSelf }) => {
          const expanded = expandedId === p.id
          return (
            <div
              key={p.id}
              ref={p.id === focusPlayerId ? focusRef : undefined}
              className={`card transition-all${isSelf ? ' ring-2 ring-lobster-teal/40' : ''}`}
            >
              <div className="w-full" onClick={() => setExpandedId(expanded ? null : p.id)}>
                {/* Top row: rank · avatar · name · level · chevron */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-5 text-center flex-shrink-0">
                    #{idx + 1}
                  </span>
                  <Avatar player={p} />
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-semibold text-gray-800 truncate flex items-center gap-1.5">
                      {p.country && <FlagImg code={p.country} />}
                      {displayName(p)}
                      {p.isLeftHanded && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold ml-0.5">
                          L
                        </span>
                      )}
                      {isSelf && (
                        <span className="text-[10px] bg-lobster-teal text-white px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ml-0.5">
                          You
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right flex flex-col items-end gap-1">
                    <span
                      className={`text-sm font-bold px-2.5 py-1 rounded-lg ${levelBadge(p.adjustedLevel)}`}
                    >
                      {(p.adjustedLevel || 0).toFixed(1)}
                    </span>
                    {isAdmin && (p.pinChanges ?? 0) > 0 && (
                      <span
                        className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md flex items-center gap-1"
                        title={`PIN reset ${p.pinChanges} time${p.pinChanges === 1 ? '' : 's'}`}
                      >
                        <RotateCcw size={10} />
                        {p.pinChanges}
                      </span>
                    )}
                  </div>
                  {expanded ? (
                    <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
                  )}
                </div>
                {/* Review — always visible */}
                <div className="mt-2 pl-8">
                  <p className="text-[10px] font-bold text-lobster-teal uppercase tracking-wider mb-0.5">
                    Lobster Review
                  </p>
                  {(() => {
                    const r = corpReview(p, matches, registrations, tournaments, playerAliases)
                    return (
                      <p className="text-xs text-gray-500 leading-relaxed">
                        {r.hasLabel && (
                          <span className="font-bold text-lobster-teal">{r.scenarioLabel}</span>
                        )}
                        {r.hasLabel ? ' — ' : ''}
                        {r.body}
                      </p>
                    )
                  })()}
                </div>
              </div>

              {expanded && (
                <PlayerProfileDrawer
                  player={p}
                  players={players}
                  matches={matches}
                  tournaments={tournaments}
                  registrations={registrations}
                  playerAliases={playerAliases}
                  isAdmin={isAdmin}
                  onNavigate={onNavigate}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onRegeneratePin={handleRegeneratePin}
                  onOpenAliasMatcher={() => setShowAliasMatcher(true)}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* PIN reveal / pending confirmation modal */}
      <PinRevealModal pinReveal={pinReveal} onClose={() => setPinReveal(null)} />

      {/* Add/Edit modal */}
      <PlayerForm
        showForm={showForm}
        editId={editId}
        isAdmin={isAdmin}
        form={form}
        setForm={setForm}
        avatarPreview={avatarPreview}
        fileInputRef={fileInputRef}
        handleAvatarChange={handleAvatarChange}
        handleSubmit={handleSubmit}
        saving={saving}
        mergePlayer={mergePlayer}
        setMergePlayer={setMergePlayer}
        acceptMerge={acceptMerge}
        lobbyPrompt={lobbyPrompt}
        onClose={() => {
          setShowForm(false)
          setAvatarFile(null)
          setAvatarPreview(null)
        }}
      />
    </div>
  )
}
