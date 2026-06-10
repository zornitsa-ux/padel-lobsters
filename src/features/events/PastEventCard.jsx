import React from 'react'
import { useRegistrations } from './useRegistrations'
import { Pencil, Trash2, Calendar, Users, MapPin, Clock, Building2 } from 'lucide-react'
import DateTile from '../../components/ui/DateTile'
import { fmtEur } from '../../lib/format'
import { formatDate, pricePerPlayer } from './eventHelpers'

function InfoChip({ icon, label, warn }) {
  return (
    <div
      className={`flex items-center gap-1 text-xs rounded-lg px-2 py-1.5 ${warn ? 'bg-orange-50 text-orange-600' : 'bg-gray-50 text-gray-600'}`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </div>
  )
}

export default function PastEventCard({ t, isAdmin, onNavigate, onEdit, onDelete }) {
  const { data: regsData = [] } = useRegistrations(t?.id)
  const bookedCount = (t.courts || []).filter((c) => c.booked).length
  const totalCourts = (t.courts || []).length
  const ppCost = pricePerPlayer(t)

  return (
    <div className="card opacity-80">
      <div className="flex items-start gap-3 mb-3">
        <DateTile date={t.date} size="sm" className="grayscale" />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-700 truncate">
            <button
              onClick={() => onNavigate('registration', t)}
              className="hover:text-lobster-teal active:scale-95 transition-all text-left"
            >
              {t.name}
            </button>
          </h3>
          <p className="text-sm font-semibold text-gray-600 flex items-center gap-1 mt-0.5">
            <Calendar size={12} /> {formatDate(t.date)}
            {t.time && <span className="text-gray-400">· {t.time}</span>}
          </p>
          {t.location && (
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
              <Building2 size={11} /> {t.location}
            </p>
          )}
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
          completed
        </span>
      </div>
      {(() => {
        const regCount = regsData.filter((r) => r.status === 'registered').length
        return (
          <div className="flex flex-wrap gap-1.5 mb-3">
            <InfoChip icon={<Users size={12} />} label={`${regCount}/${t.maxPlayers || '?'}`} />
            <InfoChip icon={<MapPin size={12} />} label={`${bookedCount}/${totalCourts}`} />
            <InfoChip
              icon={<Clock size={12} />}
              label={t.duration ? `${t.duration}min` : '90min'}
            />
            <InfoChip icon={null} label={ppCost > 0 ? `${fmtEur(ppCost)}/pp` : 'Free'} />
          </div>
        )
      })()}
      <div className="flex gap-2 pt-2 border-t border-gray-100">
        <button
          onClick={() => onNavigate('registration', t)}
          className="flex-1 text-xs font-semibold text-lobster-teal py-2 rounded-xl bg-lobster-cream active:scale-95 transition-all"
        >
          Registrations
        </button>
        <button
          onClick={() => onNavigate('schedule', t)}
          className="flex-1 text-xs font-semibold text-gray-600 py-2 rounded-xl bg-gray-100 active:scale-95 transition-all"
        >
          Schedule
        </button>
        {isAdmin && (
          <>
            <button
              onClick={() => onEdit(t)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 active:scale-95"
            >
              <Pencil size={14} className="text-gray-600" />
            </button>
            <button
              onClick={() => onDelete(t.id)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-50 active:scale-95"
            >
              <Trash2 size={14} className="text-red-500" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
