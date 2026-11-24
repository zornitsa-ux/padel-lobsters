import { useQuery } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { hasRecentEmailCode } from '../auth/sessionClaims'
import { removeAvatar, updatePlayer } from '../players/playerQueries'
import { deletionSummaryKey, fetchDeletionSummary, type DeleteStatus } from './deletionQueries'

// Shared by a member deleting their own account (DESIGN §3.1) and an admin
// deleting a member's (§3.2). The matching components are in deletionSteps.tsx.

export type DeletionStep = 'idle' | 'summary' | 'code' | 'confirm'

// A minute under the server's 10, so a code doesn't expire between check and call.
const CODE_MAX_AGE_SECONDS = 540

/** The deletion code the server will want is still fresh. */
export const codeIsFresh = ({ session }: { session: Session | null }) =>
  hasRecentEmailCode({ session, maxAgeSeconds: CODE_MAX_AGE_SECONDS })

/** The admin's typed confirmation matches the player's name, ignoring case and outer spaces. */
export const typedNameMatches = ({ typed, name }: { typed: string; name: string }) =>
  typed.trim().toLowerCase() === name.trim().toLowerCase()

export function useDeletionSummary({ targetId }: { targetId?: string }) {
  return useQuery({
    queryKey: deletionSummaryKey({ targetId }),
    queryFn: () => fetchDeletionSummary({ targetId }),
    // Never shown from cache: after a refusal the summary must be read again.
    gcTime: 0,
  })
}

export type DeletionOutcome = { done: true } | { done: false; refusal?: string; error: string }

interface DeletionMessages {
  refusals: Partial<Record<DeleteStatus, string>>
  photoFailed: string
  deleteFailed: string
}

// The photo goes first (DESIGN §2.4): if that fails nothing has changed. If
// the delete fails after it, only the photo is lost, and avatar_url is cleared
// so no profile shows a broken image.
export async function removePhotoThenDelete({
  playerId,
  role,
  deleteAccount,
  messages,
}: {
  playerId: string
  role: 'player' | 'admin'
  deleteAccount: () => Promise<DeleteStatus>
  messages: DeletionMessages
}): Promise<DeletionOutcome> {
  try {
    await removeAvatar({ playerId })
  } catch {
    return { done: false, error: messages.photoFailed }
  }
  const outcome = await deleteAfterPhoto({ deleteAccount, messages })
  if (!outcome.done) await updatePlayer(playerId, { avatarUrl: '' }, role).catch(() => {})
  return outcome
}

async function deleteAfterPhoto({
  deleteAccount,
  messages,
}: {
  deleteAccount: () => Promise<DeleteStatus>
  messages: DeletionMessages
}): Promise<DeletionOutcome> {
  try {
    const status = await deleteAccount()
    if (status === 'deleted' || status === 'already_deleted') return { done: true }
    return { done: false, refusal: messages.refusals[status], error: messages.deleteFailed }
  } catch {
    return { done: false, error: messages.deleteFailed }
  }
}
