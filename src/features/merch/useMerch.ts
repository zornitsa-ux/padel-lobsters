import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { merchKeys } from './merchKeys'
import {
  cancelMerchOrder,
  createMerchItem,
  deactivateMerchItem,
  fetchMerchInterests,
  fetchMerchItems,
  placeMerchOrder,
  reorderMerchItems,
  setOrderStatus,
  updateMerchItem,
  uploadMerchImages,
} from './merchQueries'
import { applyOrder, selectActiveItems } from './merchSelectors'
import type { MerchItem } from './merchSchemas'

// Reads follow the flat-reads model: mount load plus the query client's global
// refetchOnWindowFocus (src/lib/queryClient.ts). The manual useRefreshOnFocus
// call the container used to make is redundant here and has been removed.
//
// One cache entry holds every item; `activeOnly` filters it through `select`,
// so the shop and the (pass B) full-catalogue consumers share one request.
export function useMerchItems({ activeOnly = true }: { activeOnly?: boolean } = {}) {
  return useQuery({
    queryKey: merchKeys.items(),
    queryFn: fetchMerchItems,
    select: activeOnly ? selectActiveItems : undefined,
  })
}

export function useMerchInterests() {
  return useQuery({ queryKey: merchKeys.interests(), queryFn: fetchMerchInterests })
}

export function useMerchActions() {
  const qc = useQueryClient()
  const invalidateItems = () => qc.invalidateQueries({ queryKey: merchKeys.items() })
  const invalidateInterests = () => qc.invalidateQueries({ queryKey: merchKeys.interests() })

  const createItem = useMutation({ mutationFn: createMerchItem, onSuccess: invalidateItems })
  const updateItem = useMutation({ mutationFn: updateMerchItem, onSuccess: invalidateItems })
  const deactivateItem = useMutation({
    mutationFn: deactivateMerchItem,
    onSuccess: invalidateItems,
  })

  const reorderItems = useMutation({
    mutationFn: reorderMerchItems,
    onMutate: async ({ orderedIds }) => {
      await qc.cancelQueries({ queryKey: merchKeys.items() })
      const previous = qc.getQueryData<MerchItem[]>(merchKeys.items())
      if (previous) qc.setQueryData(merchKeys.items(), applyOrder({ items: previous, orderedIds }))
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(merchKeys.items(), context.previous)
    },
    onSettled: invalidateItems,
  })

  // No cache to invalidate — the uploaded URLs go into the editor form and are
  // persisted by the following createItem/updateItem call.
  const uploadImages = useMutation({ mutationFn: uploadMerchImages })

  const placeOrder = useMutation({ mutationFn: placeMerchOrder, onSuccess: invalidateInterests })
  const markOrder = useMutation({ mutationFn: setOrderStatus, onSuccess: invalidateInterests })
  const cancelOrder = useMutation({ mutationFn: cancelMerchOrder, onSuccess: invalidateInterests })

  return {
    createItem,
    updateItem,
    deactivateItem,
    reorderItems,
    uploadImages,
    placeOrder,
    markOrder,
    cancelOrder,
  }
}
