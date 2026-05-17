import React from 'react'
import { X } from 'lucide-react'

export default function ErrorBanner({ message, onDismiss }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm flex items-start gap-2">
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} className="text-red-400 hover:text-red-600">
        <X size={14} />
      </button>
    </div>
  )
}
