import React from 'react'
import { useApp } from '../context/useApp'

export default function SetupGuard({ children }: { children?: React.ReactNode }) {
  const { loading } = useApp()

  if (loading) {
    return (
      <div className="min-h-screen bg-lob-cream flex flex-col items-center justify-center gap-4">
        <img
          src="/logo-256.webp"
          alt="Padel Lobsters"
          width="96"
          height="96"
          className="w-24 h-24 rounded-full bg-white p-1.5 object-contain animate-pulse"
        />
        <p className="text-lob-teal font-semibold">Loading...</p>
      </div>
    )
  }

  return <>{children}</>
}
