import { AlertCircle } from 'lucide-react'

interface FormErrorProps {
  /** Renders nothing when empty. */
  message?: string
  /** Pair with `useFieldError` so the field points at this message. */
  id?: string
  /** Inline follow-up after the message: a `TextButton size="inherit"`. */
  action?: React.ReactNode
  /** Checked as the user types or picks: announced politely (`status`), not as an interrupting alert. */
  polite?: boolean
}

/**
 * A field's error, or a check across the inputs above it, shown while editing.
 * A failed save or load is `AlertBox variant="error"`.
 */
export function FormError({ message, id, action, polite = false }: FormErrorProps) {
  if (!message) return null
  return (
    <p
      id={id}
      role={polite ? 'status' : 'alert'}
      className="flex items-start gap-1 text-xs font-medium text-lob-danger"
    >
      <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
      <span>
        {message}
        {action && <> {action}</>}
      </span>
    </p>
  )
}
