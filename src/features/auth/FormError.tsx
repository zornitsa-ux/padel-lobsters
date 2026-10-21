import { AlertCircle } from 'lucide-react'

export function FormError({ message, id }: { message: string; id?: string }) {
  if (!message) return null
  return (
    <p id={id} role="alert" className="text-xs text-red-500 font-medium flex items-start gap-1">
      <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
      <span>{message}</span>
    </p>
  )
}
