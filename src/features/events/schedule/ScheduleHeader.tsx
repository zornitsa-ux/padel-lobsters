import React from 'react'
import { ChevronLeft } from 'lucide-react'

type Props = {
  tournamentName?: string
  tournamentDate?: string
  onBack: () => void
  formattedDate: string
}

export default function ScheduleHeader({
  tournamentName,
  tournamentDate,
  onBack,
  formattedDate,
}: Props) {
  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-lobster-teal text-sm font-semibold mb-2"
      >
        <ChevronLeft size={16} /> Events
      </button>
      <h2 className="text-lg font-bold text-gray-800">{tournamentName}</h2>
      <p className="text-sm text-gray-500">Schedule · {tournamentDate ? formattedDate : '—'}</p>
    </div>
  )
}
