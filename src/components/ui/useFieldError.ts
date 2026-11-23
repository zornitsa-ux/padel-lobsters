import { useId } from 'react'

/**
 * Ties a field to its `FormError`: spread `fieldProps` on the input, pass `errorId` as the error's `id`.
 * `describedBy` (a hint's id) stays on the field, after the error while there is one.
 */
export function useFieldError({
  message,
  describedBy,
}: {
  message?: string
  describedBy?: string
}) {
  const errorId = useId()
  const ids = [message && errorId, describedBy].filter(Boolean).join(' ')
  const fieldProps = {
    ...(message ? { 'aria-invalid': true as const } : {}),
    ...(ids ? { 'aria-describedby': ids } : {}),
  }
  return { errorId, fieldProps }
}
