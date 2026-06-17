import React, { useState } from 'react'
import { useRegistrations } from './useRegistrations'
import {
  Calendar,
  Users,
  MapPin,
  Clock,
  CheckCircle,
  Circle,
  Building2,
  ShieldCheck,
  UserCog,
} from 'lucide-react'
import EventAdminMenu from './EventAdminMenu'
import DateTile from '../../components/ui/DateTile'
import AddToCalendarButton from '../../components/ui/AddToCalendarButton'
import ShareWhatsAppButton from '../../components/ui/ShareWhatsAppButton'
import { fmtEur } from '../../lib/format'
import { formatDate, formatLabel, pricePerPlayer } from './eventHelpers'

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

export default function UpcomingEventCard({
  t,
  isAdmin,
  transfers,
  onNavigate,
  onEdit,
  onDelete,
  onOpenTransfers,
  updateTournament,
}) {
  const { data: regsData = [] } = useRegistrations(t?.id)
  const allBooked = (t.courts || []).every((c) => c.booked)
  const bookedCount = (t.courts || []).filter((c) => c.booked).length
  const totalCourts = (t.courts || []).length
  const ppCost = pricePerPlayer(t)
  const isAdminAll = !t.courtBookingMode || t.courtBookingMode === 'admin_all'
  const [bookError, setBookError] = useState('')
  const [bookingIndex, setBookingIndex] = useState(null)

  const handleBookCourt = async (i) => {
    setBookError('')
    setBookingIndex(i)
    try {
      const courts = [...(t.courts || [])]
      courts[i] = { ...courts[i], booked: true }
      await updateTournament(t.id, { courts })
    } catch (err) {
      setBookError(err?.message || 'Could not book court.')
    } finally {
      setBookingIndex(null)
    }
  }

  return (
    <div className="card">
      {/* Header row — date tile is the visual anchor so players can tell
          at a glance which event is which. */}
      <div className="flex items-start gap-3 mb-3">
        <DateTile date={t.date} size="md" />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-800 truncate">
            <button
              onClick={() => onNavigate('registration', t)}
              className="hover:text-lobster-teal active:scale-95 transition-all text-left"
            >
              {t.name}
            </button>
          </h3>
          <p className="text-sm font-semibold text-gray-700 flex items-center gap-1 mt-0.5">
            <Calendar size={13} /> {formatDate(t.date)}
            {t.time && <span className="text-gray-500">· {t.time}</span>}
          </p>
          {t.location && (
            <p className="text-xs text-lobster-teal flex items-center gap-1 mt-0.5">
              <Building2 size={11} /> {t.location}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              t.status === 'completed'
                ? 'bg-gray-100 text-gray-500'
                : t.status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-100 text-blue-700'
            }`}
          >
            {t.status}
          </span>
          {t.status !== 'completed' && (
            <div className="flex gap-1">
              <ShareWhatsAppButton tournament={t} variant="icon" />
              <AddToCalendarButton tournament={t} variant="icon" />
            </div>
          )}
        </div>
      </div>

      {/* Stats row — compact for mobile */}
      {(() => {
        const regCount = regsData.filter((r) => r.status === 'registered').length
        const maxP = t.maxPlayers || '?'
        const isFull = typeof maxP === 'number' && regCount >= maxP
        return (
          <>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <InfoChip icon={<Users size={12} />} label={`${regCount}/${maxP}`} />
              <InfoChip
                icon={<MapPin size={12} />}
                label={`${bookedCount}/${totalCourts}`}
                warn={!allBooked && totalCourts > 0}
              />
              <InfoChip
                icon={<Clock size={12} />}
                label={t.duration ? `${t.duration}min` : '90min'}
              />
              <InfoChip icon={null} label={ppCost > 0 ? `${fmtEur(ppCost)}/pp` : 'Free'} />
            </div>
            {isFull ? (
              <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 mb-3">
                <p className="text-xs font-bold text-orange-700">Sold out!</p>
                <p className="text-[11px] text-orange-600 mt-0.5">
                  Someone always cancels last minute. Join the waitlist and keep your racket warm.
                </p>
              </div>
            ) : t.status !== 'completed' ? (
              <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-1.5 mb-3 flex items-center gap-1.5">
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <p className="text-xs font-semibold text-green-700">Spots open — sign up now!</p>
              </div>
            ) : null}
          </>
        )
      })()}

      {/* Pending-transfer callout — admin only. Tap to open the
          AdminTransferPanel with force-accept / cancel actions. */}
      {isAdmin &&
        (() => {
          const pendingForT = transfers.filter(
            (x) => x.status === 'pending' && String(x.tournamentId) === String(t.id),
          )
          if (pendingForT.length === 0) return null
          return (
            <button
              onClick={() => onOpenTransfers(t)}
              className="w-full mb-3 flex items-center gap-2 bg-amber-50 border border-amber-300 rounded-xl px-3 py-2 text-left active:scale-[0.99] transition-all"
            >
              <Clock size={14} className="text-amber-600 flex-shrink-0" />
              <span className="flex-1 text-xs font-semibold text-amber-800">
                {pendingForT.length === 1
                  ? '1 pending transfer'
                  : `${pendingForT.length} pending transfers`}
              </span>
              <span className="text-[10px] text-amber-600 font-semibold">Review ›</span>
            </button>
          )
        })()}

      {/* Booking mode badge — admin only */}
      {isAdmin && (
        <div className="mb-2">
          {isAdminAll ? (
            <span className="inline-flex items-center gap-1 text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-medium">
              <ShieldCheck size={11} /> Admin books all courts
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">
              <UserCog size={11} /> Players responsible per court
            </span>
          )}
          {isAdminAll && t.totalPrice > 0 && (
            <span className="ml-2 text-xs text-gray-500">
              Total {fmtEur(t.totalPrice)} incl. courts + food + prizes
            </span>
          )}
        </div>
      )}

      {/* Courts — horizontal chips (admin only) */}
      {isAdmin && (t.courts || []).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {t.courts.map((c, i) => (
            <div
              key={i}
              className={`inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 font-medium ${
                c.booked ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'
              }`}
            >
              {c.booked ? (
                <CheckCircle size={11} className="text-green-500 flex-shrink-0" />
              ) : (
                <Circle size={11} className="text-gray-300 flex-shrink-0" />
              )}
              <span>{c.name || `Court ${i + 1}`}</span>
              {!isAdminAll && c.responsible && (
                <span className="text-purple-600 ml-0.5">({c.responsible})</span>
              )}
              {isAdmin && !isAdminAll && c.costPerPerson > 0 && (
                <span className="text-gray-400 ml-0.5">{fmtEur(c.costPerPerson)}</span>
              )}
              {isAdmin && !c.booked && (
                <button
                  onClick={() => handleBookCourt(i)}
                  disabled={bookingIndex === i}
                  className="ml-0.5 bg-green-100 text-green-700 px-1.5 py-0 rounded-full text-[10px] font-semibold disabled:opacity-50"
                >
                  {bookingIndex === i ? '…' : 'Book'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {isAdmin && bookError && (
        <p className="text-xs text-red-600 mb-3" role="alert">
          {bookError}
        </p>
      )}

      {/* Format chip */}
      <p className="text-xs text-gray-400 mb-3">
        Format: <span className="font-medium text-gray-600">{formatLabel(t.format)}</span>
      </p>

      {/* Actions */}
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
        <EventAdminMenu
          isAdmin={isAdmin}
          onRaffle={() => onNavigate('raffle', t)}
          onEligibility={() => onNavigate('eligibility', t)}
          onPayments={() => onNavigate('payments', t)}
          onEdit={() => onEdit(t)}
          onDelete={() => onDelete(t.id)}
        />
      </div>
    </div>
  )
}
