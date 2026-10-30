import { useId } from 'react'

/** Ties a field to its `FormError`: spread `fieldProps` on the input, pass `errorId` as the error's `id`. */
export function useFieldError({ message }: { message?: string }) {
  const errorId = useId()
  const fieldProps = message ? { 'aria-invalid': true as const, 'aria-describedby': errorId } : {}
  return { errorId, fieldProps }
}
