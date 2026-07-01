import React from 'react'
import { useApp } from '../context/useApp'

// On first launch, check if Firebase is properly configured.
// If not, show a friendly setup screen.
export default function SetupGuard({ children }) {
  const { loading } = useApp()

  if (loading) {
    return (
      <div className="min-h-screen bg-lob-cream flex flex-col items-center justify-center gap-4">
        <img
          src="/logo-hd.png"
          alt="Padel Lobsters"
          className="w-24 h-24 rounded-full bg-white p-1.5 object-contain animate-pulse"
        />
        <p className="text-lob-teal font-semibold">Loading...</p>
      </div>
    )
  }

  return children
}
