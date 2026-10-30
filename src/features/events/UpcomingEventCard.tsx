import React, { useState, type ReactNode } from 'react'
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
} from 'lucide-react'
import EventAdminMenu from './EventAdminMenu'
import DateTile from '../../components/ui/DateTile'
import AddToCalendarButton from '../../components/ui/AddToCalendarButton'
import ShareWhatsAppButton from '../../components/ui/ShareWhatsAppButton'
import { fmtEur } from '../../lib/format'
import { errorMessage } from '../../lib/errors'
import { formatDate, formatLabel, pricePerPlayer } from './eventHelpers'
import type { EventNavigate } from './eventHelpers'
import type { NormalisedTournament, TournamentCourt } from '../../lib/normalise'
import type { NormalisedTransfer } from './transferQueries'
import { isEventOver } from './eventPhase'
import { ActionRow } from '../../components/ui/ActionRow'
import { Button } from '../../components/ui/Button'
import { AlertBox } from '../../components/ui/AlertBox'
import { TextButton } from '../../components/ui/TextButton'
import { plural } from '../../lib/plural'

function InfoChip({ icon, label, warn }: { icon: ReactNode; label: string; warn?: boolean }) {
  return (
    <div
      className={`flex items-center gap-1 text-xs rounded-lg px-2 py-1.5 ${warn ? 'bg-lob-warning-light text-lob-warning' : 'bg-lob-well text-lob-slate'}`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </div>
  )
}

interface UpcomingEventCardProps {
  t: NormalisedTournament
  isAdmin: boolean
  transfers: NormalisedTransfer[]
  onNavigate: EventNavigate
  onEdit: (t: NormalisedTournament) => void
  onDelete: (id: string) => void
  onOpenTransfers: (t: NormalisedTournament) => void
  updateTournament: (id: string, data: { courts: TournamentCourt[] }) => Promise<unknown>
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
}: UpcomingEventCardProps) {
  const { data: regsData = [] } = useRegistrations(t?.id)
  const over = isEventOver({ tournament: t })
  const allBooked = (t.courts || []).every((c) => c.booked)
  const bookedCount = (t.courts || []).filter((c) => c.booked).length
  const totalCourts = (t.courts || []).length
  const ppCost = pricePerPlayer(t)
  const [bookError, setBookError] = useState('')
  const [bookingIndex, setBookingIndex] = useState<number | null>(null)

  const handleBookCourt = async (i: number) => {
    setBookError('')
    setBookingIndex(i)
    try {
      const courts = [...(t.courts || [])]
      courts[i] = { ...courts[i], booked: true }
      await updateTournament(t.id, { courts })
    } catch (err) {
      setBookError(errorMessage(err, 'Could not book court.'))
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
          <h3 className="font-bold text-lob-dark truncate">{t.name}</h3>
          <p className="text-sm font-semibold text-lob-slate flex items-center gap-1 mt-0.5">
            <Calendar size={13} /> {formatDate(t.date)}
            {t.time && <span className="text-lob-muted">· {t.time}</span>}
          </p>
          {t.location && (
            <p className="text-xs text-lob-teal flex items-center gap-1 mt-0.5">
              <Building2 size={11} /> {t.location}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              over
                ? 'bg-gray-100 text-lob-muted'
                : t.status === 'active'
                  ? 'bg-lob-success-soft text-lob-success'
                  : 'bg-blue-100 text-blue-700'
            }`}
          >
            {over ? 'completed' : t.status}
          </span>
          {!over && (
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
              <div className="mb-3">
                <AlertBox variant="warning" size="sm" title="Sold out!">
                  Someone always cancels last minute. Join the waitlist and keep your racket warm.
                </AlertBox>
              </div>
            ) : !over ? (
              <div className="mb-3">
                <AlertBox
                  variant="success"
                  size="sm"
                  icon={
                    <span className="relative flex h-2 w-2 mt-0.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lob-success-solid opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-lob-success-solid"></span>
                    </span>
                  }
                  title="Spots open — sign up now!"
                />
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
            <div className="mb-3">
              <AlertBox
                variant="warning"
                icon={<Clock />}
                title={plural({ count: pendingForT.length, one: 'pending transfer' })}
                action={
                  <TextButton tone="warning" onClick={() => onOpenTransfers(t)}>
                    Review
                  </TextButton>
                }
              />
            </div>
          )
        })()}

      {/* Booking mode badge — admin only */}
      {isAdmin && (
        <div className="mb-2">
          <span className="inline-flex items-center gap-1 text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-medium">
            <ShieldCheck size={11} /> Admin books all courts
          </span>
          {t.totalPrice > 0 && (
            <span className="ml-2 text-xs text-lob-muted">
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
                c.booked ? 'bg-lob-success-light text-lob-success' : 'bg-lob-well text-lob-muted'
              }`}
            >
              {c.booked ? (
                <CheckCircle size={11} className="text-lob-success-solid flex-shrink-0" />
              ) : (
                <Circle size={11} className="text-lob-muted-light/60 flex-shrink-0" />
              )}
              <span>{c.name || `Court ${i + 1}`}</span>
              {isAdmin && !c.booked && (
                <TextButton onClick={() => handleBookCourt(i)} disabled={bookingIndex === i}>
                  {bookingIndex === i ? '…' : 'Book'}
                </TextButton>
              )}
            </div>
          ))}
        </div>
      )}
      {isAdmin && bookError && (
        <p className="text-xs text-lob-danger mb-3" role="alert">
          {bookError}
        </p>
      )}

      {/* Format chip */}
      <p className="text-xs text-lob-muted-light mb-3">
        Format: <span className="font-medium text-lob-slate">{formatLabel(t.format)}</span>
      </p>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-lob-line">
        <div className="flex-1">
          <ActionRow>
            <Button variant="secondary" size="sm" onClick={() => onNavigate('registration', t)}>
              Registrations
            </Button>
            <Button variant="neutral" size="sm" onClick={() => onNavigate('schedule', t)}>
              Schedule
            </Button>
          </ActionRow>
        </div>
        <EventAdminMenu
          isAdmin={isAdmin}
          onEdit={() => onEdit(t)}
          onDelete={() => onDelete(t.id)}
        />
      </div>
    </div>
  )
}
