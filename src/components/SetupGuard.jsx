import React, { useState } from 'react'
import { useApp } from '../context/AppContext'

// On first launch, check if Firebase is properly configured.
// If not, show a friendly setup screen.
export default function SetupGuard({ children }) {
  const { loading } = useApp()
  const [dismissed, setDismissed] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen bg-lobster-cream flex flex-col items-center justify-center gap-4">
        <img src="/logo.png" alt="Padel Lobsters" className="w-24 h-24 rounded-full animate-pulse" />
        <p className="text-lobster-teal font-semibold">Loading...</p>
      </div>
    )
  }

  return children
}
