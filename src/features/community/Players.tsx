import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useApp } from '../../context/useApp'
import { useTournaments } from '../events/useTournaments'
import { usePlayers, usePlayerActions, useAvatarUpload } from '../players/usePlayers'
import { randomAvatarFilename } from '../players/playerQueries'
import { useAllMatches } from '../events/useMatches'
import { useAllRegistrations } from '../events/useRegistrations'
import usePlayerAliases from '../../hooks/usePlayerAliases'
import { Search } from 'lucide-react'
import { processAvatar } from '../../lib/processAvatar'
import { LEVEL_COLORS, randomPrompt, emptyForm, type PlayerFormState } from './playerConstants'
import { corpReview } from './reviewScenarios'
import { errorMessage } from '../../lib/errors'
import { useConfirm } from '../../lib/confirmBus'
import { useResolvePlayerPii } from './useRevealPii'
import { AlertBox } from '../../components/ui/AlertBox'
import PlayerForm from './PlayerForm'
import LinkPlayerModal from './LinkPlayerModal'
import PinRevealModal from './PinRevealModal'
import PendingApprovalsList from './PendingApprovalsList'
import PlayersList from './PlayersList'
import { getMissingPlayerFormFields } from './playerFormSchema'
import { buildPlayerEditPatch } from './playerPatch'
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
  const confirm = useConfirm()
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

  // ── Admin PII, per-player ────────────────────────────────────────────
  // players_public withholds email/phone/birthday/notes, so admin write
  // paths that need them resolve one player at a time through
  // admin_get_player_pii — never a whole-roster fetch. Every admin action
  // that seeds a form from a player record (or writes one back) must
  // resolve through this first: reading a possibly-stale/unloaded cache
  // directly is what once let an admin action silently null out a player's
  // email (2026-08-15 incident). Display-only PII reveals (the drawer, the
  // pending list, the link modal's candidates) go through useRevealPii
  // instead — this resolver is for write paths only.
  const resolvePlayerPii = useResolvePlayerPii()
  const resolveWithPii = useCallback(
    async <T extends CommunityPlayer>(p: T): Promise<T> => {
      const pii = await resolvePlayerPii(String(p.id))
      return { ...p, email: pii.email, phone: pii.phone, birthday: pii.birthday, notes: pii.notes }
    },
    [resolvePlayerPii],
  )
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  // The exact (PII-resolved) record that seeded the currently-open edit
  // form. handleSubmit diffs against this rather than sending every field,
  // so a field the admin never touched can never be sent as a blank clear.
  // null while editId is set means the PII resolve is still in flight.
  const [editSource, setEditSource] = useState<CommunityPlayer | null>(null)
  // Merge-resolution is an explicit admin approval of a pending signup, so
  // that save alone is allowed to also activate the record — a plain edit
  // (openEdit) never should. See buildPlayerEditPatch.
  const [editActivates, setEditActivates] = useState(false)
  const [formReady, setFormReady] = useState(true)
  const [form, setForm] = useState<PlayerFormState>(emptyForm)
  const lobbyPrompt = useMemo(() => randomPrompt(), [])
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(focusPlayerId || null)
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

  // No PII overlay here — the roster (and everything derived from it below)
  // is the public, redacted view. PII is revealed per-player, on demand, by
  // the components that actually show it (PlayerProfileDrawer,
  // PendingApprovalsList, LinkPlayerModal via useRevealPii).
  const activePlayers = players.filter((p) => (p.status || 'active') === 'active')
  const pendingPlayers = players.filter((p) => p.status === 'pending')

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

  // Guards against out-of-order async resolves: opening player A then
  // quickly player B, with A's PII resolving last, must not land A's data
  // on a form that's now editing B. Shared by openEdit and acceptMerge —
  // each bumps the token before awaiting, then checks it's still current
  // before every state commit (including the error path) so a stale
  // rejection can't unblock or error a newer, still-loading form.
  const editRequestRef = useRef(0)

  // Accept merge: pre-fill form with existing player data, switch to update mode.
  // Also reachable by a self-registering (non-admin) player whose typed name
  // matches an existing record — admin_get_player_pii is admin-gated, so
  // only resolve through it for admins; a non-admin merge falls back to the
  // (PII-less) roster record, which is safe because handleSubmit diffs
  // against exactly this same object as its baseline (see buildPlayerEditPatch).
  const acceptMerge = async () => {
    if (!mergePlayer) return
    const token = ++editRequestRef.current
    setError('')
    setFormReady(false)
    try {
      const p = isAdmin ? await resolveWithPii(mergePlayer) : mergePlayer
      if (editRequestRef.current !== token) return
      setForm(formFromPlayer(p))
      setAvatarPreview(p.avatarUrl || null)
      setEditId(p.id)
      setEditSource(p)
      setEditActivates(p.status === 'pending')
      setMergePlayer(null)
    } catch (err) {
      if (editRequestRef.current !== token) return
      setError(errorMessage(err, "Could not load this player's details."))
    } finally {
      if (editRequestRef.current === token) setFormReady(true)
    }
  }

  const openEdit = async (p: CommunityPlayer) => {
    if (!isAdmin) {
      onNavigate?.('settings')
      return
    }
    const token = ++editRequestRef.current
    setError('')
    setAvatarFile(null)
    setAvatarPreview(null)
    setForm(emptyForm)
    setEditId(p.id)
    setEditSource(null)
    setEditActivates(false)
    setFormReady(false)
    setShowForm(true)
    try {
      const full = await resolveWithPii(p)
      if (editRequestRef.current !== token) return
      setForm(formFromPlayer(full))
      setAvatarPreview(full.avatarUrl || null)
      setEditSource(full)
      setFormReady(true)
    } catch (err) {
      if (editRequestRef.current !== token) return
      setError(errorMessage(err, 'Could not load this player for editing.'))
      setShowForm(false)
      setEditId(null)
      setFormReady(true)
    }
  }

  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      onNavigate?.('settings')
      return
    }
    if (!(await confirm({ message: 'Remove this player?', destructive: true }))) return
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
      // Explicit status transition only — approving a signup should never
      // also rewrite name/level/contact fields. Previously this spread the
      // whole player record, which meant an unresolved PII overlay could
      // silently blank fields on save (same class of bug as the edit form).
      await updatePlayer(p.id, { status: 'active' })
      // Phase 2d: PIN was already emailed at signup; no need to share via
      // WhatsApp on approval. If the player lost their PIN, they use
      // "Forgot PIN?" on the sign-in screen for self-service recovery.
    } catch (err) {
      setError(errorMessage(err, 'Could not approve player.'))
    }
  }

  const handleReject = async (id: string) => {
    if (
      !(await confirm({
        message: 'Reject and remove this registration request?',
        destructive: true,
      }))
    )
      return
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

    setError('')
    try {
      // Resolve full PII for BOTH records before merging — this used to
      // read existingPlayer.email/phone/notes straight from the (possibly
      // PII-unresolved) list props via `||`, which turns "unknown" into
      // "blank" and can wipe the existing player's real contact info with
      // no visible tell in the UI. Never merge from unresolved records.
      const [existingFull, pendingFull] = await Promise.all([
        resolveWithPii(existingPlayer),
        resolveWithPii(pending),
      ])
      // Only fill genuinely-empty fields on the existing player from the
      // pending signup — never overwrite a value the existing player
      // already has.
      const merged = {
        name: existingFull.name,
        email: existingFull.email || pendingFull.email || '',
        phone: existingFull.phone || pendingFull.phone || '',
        country: existingFull.country || pendingFull.country || '',
        gender: existingFull.gender || pendingFull.gender || '',
        playtomicLevel: existingFull.playtomicLevel || pendingFull.playtomicLevel || 0,
        playtomicUsername: existingFull.playtomicUsername || pendingFull.playtomicUsername || '',
        isLeftHanded: existingFull.isLeftHanded || pendingFull.isLeftHanded || false,
        avatarUrl: existingFull.avatarUrl || pendingFull.avatarUrl || '',
        notes: existingFull.notes || pendingFull.notes || '',
      }
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
    // Defense in depth: editSource is set by openEdit/acceptMerge once the
    // PII resolve completes. If some future entry point sets editId without
    // going through one of those, refuse to submit rather than diff against
    // nothing (which buildPlayerEditPatch requires a real source for).
    if (editId && !editSource) {
      setError('Player data is still loading — try again in a moment.')
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
      try {
        if (editId) {
          // Diff against the exact record that seeded the form — only
          // genuinely-changed fields go in the payload. taglineLabel/status
          // are deliberately NOT sent unconditionally here (they used to
          // be): taglineLabel only follows an actual notes edit, and status
          // transitions are explicit actions elsewhere (handleApprove),
          // not a side effect of saving unrelated fields.
          const patch = buildPlayerEditPatch({
            form,
            avatarUrl,
            combinedName,
            notesPromptLabel: lobbyPrompt.label,
            source: editSource as CommunityPlayer,
            activate: editActivates,
          })
          await updatePlayer(editId, patch)
        } else {
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
        setEditSource(null)
        setEditActivates(false)
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
        <AlertBox variant="error" onDismiss={() => setError('')} className="text-xs">
          {error}
        </AlertBox>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-lob-dark">
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
          <span className="bg-gray-100 text-lob-muted font-semibold px-2 py-0.5 rounded-full">
            {genericCount} generic
          </span>
          <span className="text-lob-muted-light">
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
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-lob-muted-light"
        />
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
        formReady={formReady}
        mergePlayer={mergePlayer}
        setMergePlayer={setMergePlayer}
        acceptMerge={acceptMerge}
        lobbyPrompt={lobbyPrompt}
        onClose={() => {
          setShowForm(false)
          setAvatarFile(null)
          setAvatarPreview(null)
          setEditSource(null)
          setEditActivates(false)
        }}
      />
    </div>
  )
}
