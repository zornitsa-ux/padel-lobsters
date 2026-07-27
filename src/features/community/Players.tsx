import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useApp } from '../../context/useApp'
import { useTournaments } from '../events/useTournaments'
import { usePlayers, usePlayersPii, usePlayerActions, useAvatarUpload } from '../players/usePlayers'
import { randomAvatarFilename } from '../players/playerQueries'
import { useAllMatches } from '../events/useMatches'
import { useAllRegistrations } from '../events/useRegistrations'
import usePlayerAliases from '../../hooks/usePlayerAliases'
import { Search } from 'lucide-react'
import { processAvatar } from '../../lib/processAvatar'
import { LEVEL_COLORS, randomPrompt, emptyForm, type PlayerFormState } from './playerConstants'
import { corpReview } from './reviewScenarios'
import { errorMessage } from '../../lib/errors'
import PlayerForm from './PlayerForm'
import LinkPlayerModal from './LinkPlayerModal'
import PinRevealModal from './PinRevealModal'
import PendingApprovalsList from './PendingApprovalsList'
import PlayersList from './PlayersList'
import { getMissingPlayerFormFields } from './playerFormSchema'
import {
  buildFirstNameCount,
  computeReviewCounts,
  getDisplayName,
  orderPlayersForRender,
  sortPlayersChronological,
} from './playersSelectors'
import type { CommunityPlayer } from './playersSelectors'
import type { PinReveal } from './PinRevealModal'
import type { EventNavigate } from '../events/eventHelpers'

const GENERIC_REVIEW_IDS = new Set([
  'level-low',
  'level-mid',
  'level-high',
  'level-elite',
  'welcome',
])

// Fill the add/edit form from an existing player. The stored single-string
// `name` is split so the two-field form populates: single-word names go
// entirely into firstName and admin can fill in the surname.
function formFromPlayer(p: CommunityPlayer): PlayerFormState {
  const nameParts = (p.name || '').trim().split(/\s+/)
  return {
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' '),
    name: p.name || '',
    email: p.email || '',
    phone: p.phone || '',
    playtomicLevel: p.playtomicLevel ?? '',
    playtomicUsername: p.playtomicUsername || '',
    notes: p.notes || '',
    gender: p.gender || '',
    isLeftHanded: p.isLeftHanded || false,
    country: p.country || '',
    avatarUrl: p.avatarUrl || '',
    birthday: p.birthday || '',
    preferredPosition: p.preferredPosition || '',
  }
}

interface PlayersProps {
  onNavigate?: EventNavigate
  focusPlayerId?: string | null
}

export default function Players({ onNavigate, focusPlayerId }: PlayersProps) {
  const { session, role } = useApp()
  const { addPlayer, updatePlayer, deletePlayer, regeneratePin } = usePlayerActions({
    session,
    role,
  })
  const uploadAvatar = useAvatarUpload()
  const { data: tournaments = [] } = useTournaments()
  const { data: players = [] } = usePlayers()
  const { data: matches = [] } = useAllMatches()
  const { data: registrations = [] } = useAllRegistrations()
  const { playerAliases } = usePlayerAliases()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const claimedId = session?.user?.id ?? null

  // ── Admin PII overlay ───────────────────────────────────────────────
  // players_public withholds email/phone/birthday/notes/pin, so for admins we
  // fetch the full rows through the admin-gated RPC and overlay them by id.
  // The query is disabled for everyone else (see usePlayersPii).
  const { data: piiById, error: piiError } = usePlayersPii({ role })

  // Merge a player record with the admin PII overlay. Non-admins get the
  // record unchanged (which means empty PII fields after Phase 3 — fine,
  // the admin-gated UI hides those fields anyway).
  const withPii = useCallback(
    <T extends CommunityPlayer>(p: T): T => {
      const extra = piiById?.[String(p.id)]
      if (!extra) return p
      return {
        ...p,
        email: extra.email || p.email || '',
        phone: extra.phone || p.phone || '',
        birthday: extra.birthday || p.birthday || '',
        notes: extra.notes || p.notes || '',
        pin: extra.pin || p.pin || '',
      }
    },
    [piiById],
  )
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | number | null>(null)
  const [form, setForm] = useState<PlayerFormState>(emptyForm)
  const lobbyPrompt = useMemo(() => randomPrompt(), [])
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | number | null>(focusPlayerId || null)
  const focusRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll to focused player card
  useEffect(() => {
    if (focusPlayerId && focusRef.current) {
      setTimeout(() => {
        focusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 150)
    }
  }, [focusPlayerId])
  const [saving, setSaving] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  // existing player found by name
  const [mergePlayer, setMergePlayer] = useState<CommunityPlayer | null>(null)
  // shown after registration
  const [pinReveal, setPinReveal] = useState<PinReveal | null>(null)
  // pending player being linked
  const [linkModal, setLinkModal] = useState<CommunityPlayer | null>(null)
  const [linkSearch, setLinkSearch] = useState('') // search in link modal
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Overlay admin PII onto every record up-front so downstream filtering,
  // rendering, and form-fill calls just see the merged object.
  const playersWithPii = useMemo(() => players.map(withPii), [players, withPii])
  const activePlayers = playersWithPii.filter((p) => (p.status || 'active') === 'active')
  const pendingPlayers = playersWithPii.filter((p) => p.status === 'pending')

  const filtered = activePlayers.filter((p) => p.name?.toLowerCase().includes(search.toLowerCase()))
  const sorted = useMemo(() => sortPlayersChronological(filtered), [filtered])

  // Pin the logged-in player's card to the top when no search is active.
  // During search the self card just shows up via the regular filtered
  // list (or disappears entirely if their name doesn't match the query).
  // The original chronological index (`idx`) is preserved on the pair so
  // the rank badge `#${idx + 1}` keeps reflecting join order, not the
  // display position.
  const orderedForRender = useMemo(
    () => orderPlayersForRender(sorted, search, claimedId),
    [sorted, search, claimedId],
  )

  // A scenario is "generic" if it's the level-based fallback or the welcome
  // line — everything else is personalised by tournament/match data.
  const { genericCount, personalisedCount } = useMemo(
    () =>
      computeReviewCounts({
        activePlayers,
        classifyScenario: (p) =>
          corpReview(p, matches, registrations, tournaments, playerAliases).scenario,
        genericIds: GENERIC_REVIEW_IDS,
      }),
    [activePlayers, matches, registrations, tournaments, playerAliases],
  )

  // ── Name display: first name only; both players get a surname initial
  //    the moment a duplicate first name exists in the group ────────────────
  const firstNameCount = useMemo(() => buildFirstNameCount(activePlayers), [activePlayers])
  const displayName = (p: CommunityPlayer) => getDisplayName(p.name, firstNameCount)

  // Debounced duplicate check — fires 400ms after the user stops typing the name.
  // Reliable on both desktop and mobile (doesn't depend on onBlur).
  const mergeDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
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
  }, [form.name, editId, players])

  // Accept merge: pre-fill form with existing player data, switch to update mode
  const acceptMerge = () => {
    if (!mergePlayer) return
    // Re-resolve through the PII-overlay so email/phone/birthday are
    // filled in if admin has fetched them.
    const p = withPii(mergePlayer)
    setForm(formFromPlayer(p))
    setAvatarPreview(p.avatarUrl || null)
    setEditId(p.id)
    setMergePlayer(null)
  }

  const openEdit = (p: CommunityPlayer) => {
    if (!isAdmin) {
      onNavigate?.('settings')
      return
    }
    setForm(formFromPlayer(p))
    setAvatarFile(null)
    setAvatarPreview(p.avatarUrl || null)
    setEditId(p.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string | number) => {
    if (!isAdmin) {
      onNavigate?.('settings')
      return
    }
    if (!confirm('Remove this player?')) return
    setError('')
    try {
      await deletePlayer(id)
    } catch (err) {
      setError(errorMessage(err, 'Could not remove player.'))
    }
  }

  const handleApprove = async (p: CommunityPlayer) => {
    setError('')
    try {
      await updatePlayer(p.id, { ...p, status: 'active' })
      // Phase 2d: PIN was already emailed at signup; no need to share via
      // WhatsApp on approval. If the player lost their PIN, they use
      // "Forgot PIN?" on the sign-in screen for self-service recovery.
    } catch (err) {
      setError(errorMessage(err, 'Could not approve player.'))
    }
  }

  const handleReject = async (id: string | number) => {
    if (!confirm('Reject and remove this registration request?')) return
    setError('')
    try {
      await deletePlayer(id)
    } catch (err) {
      setError(errorMessage(err, 'Could not reject player.'))
    }
  }

  // Admin links a pending new joiner to an existing player profile:
  // copies their contact info onto the existing player, deletes the pending entry, sends existing PIN
  const handleLinkConfirm = async (existingPlayer: CommunityPlayer) => {
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
      setError(errorMessage(err, 'Could not link player.'))
    }
    // Phase 2d: linked profiles already had a PIN. If the player can't
    // recall it, "Forgot PIN?" on the sign-in screen sends a fresh one
    // to their email. Admin no longer needs to share via WhatsApp.
  }

  const handleRegeneratePin = async (p: CommunityPlayer) => {
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
      setError(errorMessage(err, 'Could not regenerate PIN.'))
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(String(ev.target?.result ?? ''))
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
    const missing = getMissingPlayerFormFields(form, isAdmin)
    if (missing.length > 0) {
      alert(`Please complete the following fields before registering:\n\n• ${missing.join('\n• ')}`)
      return
    }
    setSaving(true)
    setError('')
    try {
      let avatarUrl = form.avatarUrl || ''
      if (avatarFile) {
        let processed: Blob
        try {
          processed = await processAvatar(avatarFile)
        } catch (err) {
          console.error('Avatar processing error:', err)
          alert('Photo could not be processed: ' + errorMessage(err))
          setSaving(false)
          return
        }
        // A failed upload is non-fatal: the player is still saved, just
        // without the new photo.
        try {
          avatarUrl = await uploadAvatar.mutateAsync({
            file: processed,
            filename: randomAvatarFilename(),
          })
        } catch (err) {
          console.error('Avatar upload error:', err)
          alert(
            'Photo could not be saved: ' +
              errorMessage(err) +
              '\n\nMake sure the "avatars" storage bucket exists and is set to public in Supabase.',
          )
        }
      }
      // firstName / lastName are transient — the DB only knows about `name`.
      const { firstName: _f, lastName: _l, ...rest } = form
      const data = {
        ...rest,
        name: combinedName, // overwrite whatever was on form.name — single source of truth
        avatarUrl,
        playtomicLevel: parseFloat(String(form.playtomicLevel)) || 0,
        isLeftHanded: form.isLeftHanded || false,
        birthday: form.birthday || null,
        taglineLabel: lobbyPrompt.label,
        status: 'active',
      }
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
        setError(errorMessage(err, 'Could not save player.'))
      }
    } finally {
      setSaving(false)
    }
  }

  const levelBadge = (adjusted: number | null | undefined) => {
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
      {/* A failed PII dump used to be silent, leaving admins with a roster
          that looked like it simply had no contact details. */}
      {piiError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg p-2">
          Contact details could not be loaded:{' '}
          {errorMessage(piiError, 'the admin roster request failed.')}
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
        {/* "Join" button removed — new-player signup now lives exclusively
            on the home page via the sign-in / sign-up popup
            (VerificationGate → SignupRequest). The in-app Players roster
            stays focused on viewing / editing existing members. */}
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
        </div>
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
        <PlayersList
          orderedForRender={orderedForRender}
          hasPlayers={sorted.length > 0}
          focusPlayerId={focusPlayerId}
          focusRef={focusRef}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          isAdmin={isAdmin}
          levelBadge={levelBadge}
          displayName={displayName}
          matches={matches}
          registrations={registrations}
          tournaments={tournaments}
          playerAliases={playerAliases}
          players={players}
          onNavigate={onNavigate}
          onEdit={openEdit}
          onDelete={handleDelete}
          onRegeneratePin={handleRegeneratePin}
        />
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
