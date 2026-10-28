import React, { useEffect } from 'react'
import { Search, Eye, RotateCcw } from 'lucide-react'
import Avatar from '../../components/ui/Avatar'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { IconButton } from '../../components/ui/IconButton'
import { OptionRow } from '../../components/ui/OptionRow'
import { Skeleton } from '../../components/ui/Skeleton'
import { useRevealPii } from './useRevealPii'
import type { CommunityPlayer } from './playersSelectors'

// Least-exposure gate: the admin already knows who they're looking for
// (the pending signup's name is right above the search box), so nothing
// lists until they've typed enough to actually narrow it down. Listing the
// whole active roster on an empty search — the previous behaviour — showed
// every candidate simultaneously, which is the opposite of "reveal what's
// needed for this one action."
const MIN_SEARCH_LENGTH = 2

interface LinkPlayerModalProps {
  /** The pending signup being linked; null keeps the modal closed. */
  linkModal: CommunityPlayer | null
  linkSearch: string
  setLinkSearch: (value: string) => void
  activePlayers: CommunityPlayer[]
  onClose: () => void
  onConfirm: (player: CommunityPlayer) => void
}

export default function LinkPlayerModal({
  linkModal,
  linkSearch,
  setLinkSearch,
  activePlayers,
  onClose,
  onConfirm,
}: LinkPlayerModalProps) {
  // The pending signup's own email is the reference value the admin compares
  // candidates against — fetching it is unambiguously justified by opening
  // this modal (that's the whole point of the screen), so it's the one place
  // in this redesign where an on-open fetch, rather than a tap, is correct.
  const pendingId = linkModal ? String(linkModal.id) : ''
  const pendingPii = useRevealPii(pendingId)
  useEffect(() => {
    if (linkModal) pendingPii.reveal()
    // Only re-run when which pending player is being linked changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingId])

  if (!linkModal) return null

  const query = linkSearch.trim()
  const searchLongEnough = query.length >= MIN_SEARCH_LENGTH
  const candidates = searchLongEnough
    ? activePlayers.filter((p) => (p.name || '').toLowerCase().includes(query.toLowerCase()))
    : []

  return (
    <Modal open onClose={onClose} title="Link to existing player">
      <div className="space-y-3">
        <p className="text-xs text-lob-muted -mt-2">
          Who is <strong>{linkModal.name}</strong> in the system?
        </p>

        <div className="text-xs bg-lob-teal-light rounded-xl px-3 py-2">
          <span className="text-lob-muted">Signing up as </span>
          {pendingPii.isLoading && <Skeleton className="h-3 w-32 inline-block align-middle" />}
          {pendingPii.isError && (
            <span className="inline-flex items-center gap-1 text-lob-amber">
              couldn't load email
              <IconButton
                aria-label="Retry loading email"
                size="sm"
                onClick={() => pendingPii.retry()}
              >
                <RotateCcw />
              </IconButton>
            </span>
          )}
          {!pendingPii.isLoading && !pendingPii.isError && (
            <span className="font-semibold text-lob-teal">
              {pendingPii.pii?.email || 'no email on file'}
            </span>
          )}
        </div>

        <input
          type="text"
          placeholder="🔍 Search existing players… (2+ characters)"
          value={linkSearch}
          onChange={(e) => setLinkSearch(e.target.value)}
          className="input"
          autoFocus
        />

        {!searchLongEnough ? (
          <EmptyState
            className="py-6"
            icon={<Search size={22} />}
            title="Search for the existing player by name"
            description="Type at least 2 characters to see matching players."
          />
        ) : (
          <div className="space-y-1">
            {candidates.length === 0 && (
              <p className="text-xs text-lob-muted-light text-center py-4">No players match.</p>
            )}
            {candidates.map((p) => (
              <CandidateRow key={p.id} player={p} onConfirm={onConfirm} />
            ))}
          </div>
        )}

        <p className="text-xs text-lob-muted-light text-center pt-1">
          This will merge {linkModal.name}'s new contact info onto the existing profile.
        </p>
      </div>
    </Modal>
  )
}

// One candidate row. Its email is revealed independently, per row, on tap —
// never eagerly for the whole filtered list.
function CandidateRow({
  player: p,
  onConfirm,
}: {
  player: CommunityPlayer
  onConfirm: (player: CommunityPlayer) => void
}) {
  const pii = useRevealPii(String(p.id))
  return (
    <OptionRow
      onClick={() => onConfirm(p)}
      leading={<Avatar player={p} size="sm" />}
      title={p.name ?? '?'}
      subtitle={`Lv ${(p.playtomicLevel || 0).toFixed(1)}`}
      actions={
        <>
          {!pii.revealed && (
            <IconButton aria-label={`Show ${p.name}'s email`} size="sm" onClick={pii.reveal}>
              <Eye />
            </IconButton>
          )}
          {pii.revealed && pii.isLoading && (
            <span role="status" aria-live="polite">
              <span className="sr-only">Loading email…</span>
              <Skeleton className="h-3 w-24 inline-block align-middle" />
            </span>
          )}
          {pii.revealed && pii.isError && (
            <span className="inline-flex items-center gap-1 text-lob-amber">
              failed
              <IconButton
                aria-label={`Retry loading ${p.name}'s email`}
                size="sm"
                onClick={() => pii.retry()}
              >
                <RotateCcw />
              </IconButton>
            </span>
          )}
          {pii.revealed && !pii.isLoading && !pii.isError && (
            <span className="truncate">{pii.pii?.email || 'no email on file'}</span>
          )}
        </>
      }
    />
  )
}
