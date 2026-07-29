import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { transferKeys } from './transferKeys'
import { registrationKeys } from './registrationKeys'
import * as q from './transferQueries'

export function useTransfers() {
  return useQuery({
    queryKey: transferKeys.all(),
    queryFn: q.fetchTransfers,
  })
}

// Only the presence of an authenticated user matters here — the RPCs derive
// identity from auth.uid() server-side.
export function useTransferActions({
  session,
}: {
  session: { user?: { id: string } | null } | null
}) {
  const qc = useQueryClient()
  const invalidateTransfers = useCallback(
    () => qc.invalidateQueries({ queryKey: transferKeys.all() }),
    [qc],
  )
  const invalidateRegistrations = useCallback(
    () => qc.invalidateQueries({ queryKey: registrationKeys.all() }),
    [qc],
  )

  const createTransfer = useCallback(
    async (toPlayerId: string, tournamentId: string) => {
      if (!session?.user) return { ok: false, status: 'not_authenticated' }
      const result = await q.createTransfer(toPlayerId, tournamentId)
      if (result.ok) await invalidateTransfers()
      return result
    },
    [session, invalidateTransfers],
  )

  const respondToTransfer = useCallback(
    async (transferId: string, accept: boolean) => {
      if (!session?.user) return { ok: false, status: 'not_authenticated' }
      const result = await q.respondToTransfer(transferId, accept)
      if (result.ok) {
        await invalidateTransfers()
        invalidateRegistrations()
      }
      return result
    },
    [session, invalidateTransfers, invalidateRegistrations],
  )

  const cancelTransfer = useCallback(
    async (transferId: string) => {
      if (!session?.user) return { ok: false, status: 'not_authenticated' }
      const result = await q.cancelTransfer(transferId)
      if (result.ok) await invalidateTransfers()
      return result
    },
    [session, invalidateTransfers],
  )

  const getTransferRecipientContact = useCallback(
    async (transferId: string) => {
      if (!session?.user) return { ok: false, status: 'not_authenticated' }
      return q.getTransferRecipientContact(transferId)
    },
    [session],
  )

  const adminCancelTransfer = useCallback(
    async (transferId: string) => {
      const result = await q.adminCancelTransfer(transferId)
      if (result.ok) await invalidateTransfers()
      return result
    },
    [invalidateTransfers],
  )

  const forceAcceptTransfer = useCallback(
    async (transferId: string) => {
      const result = await q.forceAcceptTransfer(transferId)
      if (result.ok) {
        await invalidateTransfers()
        invalidateRegistrations()
      }
      return result
    },
    [invalidateTransfers, invalidateRegistrations],
  )

  return {
    createTransfer,
    respondToTransfer,
    cancelTransfer,
    getTransferRecipientContact,
    adminCancelTransfer,
    forceAcceptTransfer,
  }
}
