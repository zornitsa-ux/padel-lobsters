import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { useApp } from '../../context/useApp'
import { usePlayers, usePlayerActions } from '../players/usePlayers'
import { errorMessage } from '../../lib/errors'
import { useConfirm } from '../../lib/confirmBus'
import { useResolveWithPii } from './useRevealPii'
import { AlertBox } from '../../components/ui/AlertBox'
import LinkPlayerModal from './LinkPlayerModal'
import PendingApprovalsList from './PendingApprovalsList'
import PlayersList from './PlayersList'
import {
  buildFirstNameCount,
  getDisplayName,
  orderPlayersForRender,
  sortPlayersChronological,
} from './playersSelectors'
import type { CommunityPlayer } from './playersSelectors'

// The roster only needs the public player rows; stats, reviews and admin
// actions load on the player's own page (PlayerDetailPage).
export default function Players() {
  const confirm = useConfirm()
  const { session, role } = useApp()
  const { updatePlayer, deletePlayer } = usePlayerActions({ session, role })
  const { data: players = [] } = usePlayers()
  const resolveWithPii = useResolveWithPii()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const claimedId = session?.user?.id ?? null

  const [search, setSearch] = useState('')
  const [linkModal, setLinkModal] = useState<CommunityPlayer | null>(null)
  const [linkSearch, setLinkSearch] = useState('')
  const [error, setError] = useState('')

  const activePlayers = players.filter((p) => (p.status || 'active') === 'active')
  const pendingPlayers = players.filter((p) => p.status === 'pending')
  const filtered = activePlayers.filter((p) => p.name?.toLowerCase().includes(search.toLowerCase()))
  const sorted = useMemo(() => sortPlayersChronological(filtered), [filtered])
  // Self is pinned to the top when no search is active.
  const orderedForRender = useMemo(
    () => orderPlayersForRender(sorted, search, claimedId),
    [sorted, search, claimedId],
  )
  const firstNameCount = useMemo(() => buildFirstNameCount(activePlayers), [activePlayers])
  const displayName = (p: CommunityPlayer) => getDisplayName(p.name, firstNameCount)

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

      <PlayersList
        orderedForRender={orderedForRender}
        displayName={displayName}
        emptyTitle={search ? 'No players match your search.' : undefined}
      />
    </div>
  )
}
