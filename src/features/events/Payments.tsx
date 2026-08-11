import React, { useState } from 'react'
import { useApp } from '../../context/useApp'
import { usePlayers } from '../players/usePlayers'
import { useRegistrations, useRegistrationActions } from './useRegistrations'
import {
  CheckCircle,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  MoreVertical,
  MessageCircle,
} from 'lucide-react'
import { fmtEur } from '../../lib/format'
import { EmptyState } from '../../components/ui/EmptyState'
import { IconButton } from '../../components/ui/IconButton'
import { PlayerRow } from '../../components/ui/PlayerRow'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { StatTile } from '../../components/ui/StatTile'
import PaymentReminderModal from './PaymentReminderModal'
import { pricePerPlayer, type EventNavigate } from './eventHelpers'
import type { NormalisedTournament } from '../../lib/normalise'
import type { NormalisedRegistration } from './registrationQueries'

const METHODS = [
  { value: 'tikkie', label: 'Tikkie' },
  { value: 'playtomic', label: 'Playtomic' },
]

type PaymentFilter = 'all' | 'paid' | 'pending' | 'tikkied' | 'unpaid'

export default function Payments({
  tournament,
  onNavigate,
}: {
  tournament: NormalisedTournament | null
  onNavigate: EventNavigate
}) {
  const { session } = useApp()
  const { updateRegistration } = useRegistrationActions()
  const { data: players = [] } = usePlayers()
  const { data: regsData = [] } = useRegistrations(tournament?.id)
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const [filter, setFilter] = useState<PaymentFilter>('all')
  const [reminderTarget, setReminderTarget] = useState<{ regId: string; name: string } | null>(null)

  if (!tournament) {
    return (
      <EmptyState
        icon={<AlertCircle size={36} />}
        title="No event selected"
        action={
          <button
            onClick={() => onNavigate('tournament')}
            className="btn-primary mt-2 py-2 px-5 text-sm"
          >
            Go to Events
          </button>
        }
      />
    )
  }

  const regs = regsData.filter((r) => r.status === 'registered')
  // Status buckets — see Registration.jsx PayBadge for semantics.
  const confirmed = regs.filter(
    (r) => r.paymentStatus === 'paid' || r.paymentStatus === 'transferred',
  )
  const selfPaid = regs.filter((r) => r.paymentStatus === 'pending_confirmation')
  const tikkied = regs.filter((r) => r.paymentStatus === 'tikkied')
  // True "ghost" unpaid — didn't even click the Tikkie link
  const trulyUnpaid = regs.filter((r) => !r.paymentStatus || r.paymentStatus === 'unpaid')

  const costPerPlayer = pricePerPlayer(tournament)

  const totalCollected = confirmed.length * costPerPlayer
  const totalExpected = regs.length * costPerPlayer

  const filtered =
    filter === 'paid'
      ? confirmed
      : filter === 'pending'
        ? selfPaid
        : filter === 'tikkied'
          ? tikkied
          : filter === 'unpaid'
            ? trulyUnpaid
            : regs
  const getPlayer = (id: string) => players.find((p) => p.id === id)

  // Order follows the payment funnel: everyone → unpaid (never clicked) →
  // tikkied → paid (self-declared) → confirmed (admin verified).
  const filterTabs: { value: PaymentFilter; label: string; count: number; activeClass: string }[] =
    [
      { value: 'all', label: 'All', count: regs.length, activeClass: 'bg-lob-coral text-white' },
      {
        value: 'unpaid',
        label: 'Unpaid',
        count: trulyUnpaid.length,
        activeClass: 'bg-red-500 text-white',
      },
      {
        value: 'tikkied',
        label: 'Tikkied',
        count: tikkied.length,
        activeClass: 'bg-amber-500 text-white',
      },
      {
        value: 'pending',
        label: 'Paid',
        count: selfPaid.length,
        activeClass: 'bg-sky-500 text-white',
      },
      {
        value: 'paid',
        label: 'Confirmed',
        count: confirmed.length,
        activeClass: 'bg-green-600 text-white',
      },
    ]

  const handleMarkPaid = async (reg: NormalisedRegistration, method: string) => {
    if (!isAdmin) {
      onNavigate?.('settings')
      return
    }
    await updateRegistration(
      reg.id,
      { paymentStatus: 'paid', paymentMethod: method },
      tournament.id,
    )
  }

  const handleMarkUnpaid = async (reg: NormalisedRegistration) => {
    if (!isAdmin) {
      onNavigate?.('settings')
      return
    }
    await updateRegistration(reg.id, { paymentStatus: 'unpaid', paymentMethod: '' }, tournament.id)
  }

  // Manual status override — admin can jump to any state regardless of the
  // natural flow (for bookkeeping fixes, correcting miscicks, etc.)
  const handleSetStatus = async (reg: NormalisedRegistration, status: string) => {
    if (!isAdmin) {
      onNavigate?.('settings')
      return
    }
    await updateRegistration(
      reg.id,
      {
        paymentStatus: status,
        paymentMethod:
          status === 'unpaid' ? '' : reg.paymentMethod || (status === 'tikkied' ? 'tikkie' : ''),
      },
      tournament.id,
    )
  }

  return (
    <div className="space-y-4">
      {/* Payment info banner */}
      <div className="bg-lob-teal-light rounded-2xl p-4 space-y-2 border border-lob-teal/10">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={15} className="text-lob-teal" />
          <span className="text-sm font-bold text-lob-slate">Admin booked all courts</span>
        </div>
        {tournament.totalPrice > 0 && (
          <p className="text-sm text-lob-slate">
            Total: <span className="font-bold text-lob-dark">{fmtEur(tournament.totalPrice)}</span>{' '}
            · Per player: <span className="font-bold text-lob-teal">{fmtEur(costPerPlayer)}</span>
            <span className="text-xs text-lob-muted-light">
              {' '}
              (÷ {tournament.maxPlayers} players)
            </span>
          </p>
        )}
        {tournament.tikkieLink && (
          <a
            href={tournament.tikkieLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 bg-[#FF6B35] text-white text-sm font-bold px-4 py-2 rounded-xl active:scale-95 transition-all"
          >
            <ExternalLink size={14} /> Pay via Tikkie
          </a>
        )}
        {!tournament.tikkieLink && (
          <p className="text-xs text-lob-muted-light">
            No Tikkie link set — payment via Playtomic or cash
          </p>
        )}
      </div>

      {/* Summary */}
      <div className="bg-lob-teal rounded-2xl p-4 text-white shadow-lg">
        <div className="grid grid-cols-4 gap-2 mb-4">
          <StatTile
            value={confirmed.length}
            label="Confirmed"
            size="md"
            labelVariant="inverted"
            valueClassName="text-green-300"
          />
          <StatTile
            value={selfPaid.length}
            label="Paid"
            size="md"
            labelVariant="inverted"
            valueClassName="text-sky-300"
          />
          <StatTile
            value={tikkied.length}
            label="Tikkied"
            size="md"
            labelVariant="inverted"
            valueClassName="text-amber-300"
          />
          <StatTile
            value={trulyUnpaid.length}
            label="Unpaid"
            size="md"
            labelVariant="inverted"
            valueClassName="text-red-300"
          />
        </div>

        {costPerPlayer > 0 && (
          <div className="bg-white/10 rounded-xl p-3">
            <div className="flex justify-between text-sm mb-1">
              <span className="opacity-80">Cost per player</span>
              <span className="font-bold">{fmtEur(costPerPlayer)}</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span className="opacity-80">Collected</span>
              <span className="font-bold text-green-300">{fmtEur(totalCollected)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="opacity-80">Still owed</span>
              <span className="font-bold text-red-300">
                {fmtEur(totalExpected - totalCollected)}
              </span>
            </div>
            <ProgressBar
              value={totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0}
              size="lg"
              trackClassName="bg-white/20"
              fillClassName="bg-gradient-to-r from-green-300 to-green-400"
              className="mt-3 w-full"
            />
          </div>
        )}
      </div>

      {/* Filter tabs — pill style */}
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1">
        {filterTabs.map(({ value: v, label: l, count, activeClass }) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`flex-shrink-0 py-2 px-3 text-xs font-semibold rounded-full transition-all whitespace-nowrap ${
              filter === v
                ? `${activeClass} shadow-md`
                : 'bg-lob-teal-light text-lob-muted hover:bg-opacity-80'
            }`}
          >
            {l}
            <span
              className={`ml-1 text-xs font-bold ${filter === v ? 'text-white/80' : 'text-lob-muted'}`}
            >
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Payment list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <EmptyState icon={<CheckCircle size={28} />} title="No players here" />
        )}

        {filtered.map((reg) => {
          const player = getPlayer(reg.playerId)
          if (!player) return null
          const ps = reg.paymentStatus
          const isConfirmed = ps === 'paid' || ps === 'transferred'
          const isSelfPaid = ps === 'pending_confirmation'
          const isTikkied = ps === 'tikkied'
          const isTransferred = ps === 'transferred'

          const borderColor = isConfirmed
            ? 'border-green-400'
            : isSelfPaid
              ? 'border-sky-400'
              : isTikkied
                ? 'border-amber-400'
                : 'border-red-300'
          const avatarColor = isConfirmed
            ? 'bg-green-100 text-green-700'
            : isSelfPaid
              ? 'bg-sky-100 text-sky-700'
              : isTikkied
                ? 'bg-amber-100 text-amber-700'
                : 'bg-red-100 text-red-600'

          return (
            <div key={reg.id} className={`card transition-all border-l-4 ${borderColor}`}>
              <PlayerRow
                player={player}
                avatarSize="lg"
                avatarTone={avatarColor}
                name={player.name}
                trailing={
                  isAdmin && (
                    <div className="flex items-center gap-1">
                      {/* Primary action — varies by status, keeps the most common
                          next step one tap away for the admin. */}
                      {isConfirmed ? (
                        <button
                          onClick={() => handleMarkUnpaid(reg)}
                          className="text-xs text-lob-muted border border-gray-200 px-3 py-1.5 rounded-xl font-semibold active:scale-95 transition-all"
                        >
                          Undo
                        </button>
                      ) : isSelfPaid || isTikkied ? (
                        <button
                          onClick={() => handleMarkPaid(reg, reg.paymentMethod || 'tikkie')}
                          className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-xl font-semibold active:scale-95 transition-all"
                        >
                          Confirm ✓
                        </button>
                      ) : (
                        <PaymentMethodPicker onSelect={(method) => handleMarkPaid(reg, method)} />
                      )}
                      {!!tournament.tikkieLink && !isConfirmed && !isSelfPaid && (
                        <button
                          onClick={() =>
                            setReminderTarget({ regId: reg.id, name: player.name || 'this player' })
                          }
                          title="Send a WhatsApp payment reminder"
                          className="text-xs bg-[#25D366] text-white px-3 py-1.5 rounded-xl font-semibold active:scale-95 transition-all inline-flex items-center gap-1"
                        >
                          <MessageCircle size={12} /> Remind
                        </button>
                      )}
                      {/* Manual override — lets the admin set any status directly,
                          e.g. correcting a misclick or manually marking Tikkied. */}
                      <StatusOverrideMenu
                        currentStatus={ps}
                        onSelect={(s) => handleSetStatus(reg, s)}
                      />
                    </div>
                  )
                }
              >
                <div className="flex items-center gap-2 flex-wrap">
                  {isTransferred ? (
                    <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      ↔ Transferred
                    </span>
                  ) : isConfirmed ? (
                    <span className="text-xs font-semibold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      ✓ Confirmed{' '}
                      {reg.paymentMethod
                        ? `· ${METHODS.find((m) => m.value === reg.paymentMethod)?.label || reg.paymentMethod}`
                        : ''}
                    </span>
                  ) : isSelfPaid ? (
                    <span className="text-xs font-semibold bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">
                      💬 Paid (self-declared)
                    </span>
                  ) : isTikkied ? (
                    <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                      🔗 Tikkied
                    </span>
                  ) : (
                    <span className="text-xs font-semibold bg-lob-coral-light text-lob-coral px-2 py-0.5 rounded-full">
                      ⚠ Unpaid
                    </span>
                  )}
                  {costPerPlayer > 0 && !isTransferred && (
                    <span className="text-xs text-lob-muted">{fmtEur(costPerPlayer)}</span>
                  )}
                </div>
              </PlayerRow>
            </div>
          )
        })}
      </div>

      {reminderTarget && (
        <PaymentReminderModal
          registrationId={reminderTarget.regId}
          playerName={reminderTarget.name}
          onClose={() => setReminderTarget(null)}
        />
      )}
    </div>
  )
}

function PaymentMethodPicker({ onSelect }: { onSelect: (method: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-xl font-semibold active:scale-95 transition-all"
      >
        Mark Paid ▾
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-50 min-w-[130px] overflow-hidden">
            {METHODS.map((m) => (
              <button
                key={m.value}
                onClick={() => {
                  onSelect(m.value)
                  setOpen(false)
                }}
                className="w-full text-left px-4 py-2.5 text-sm font-medium text-lob-slate hover:bg-gray-50 active:bg-gray-100"
              >
                {m.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Admin-only "three dots" menu to manually set any payment status. Useful for
// fixing accidental clicks or recording out-of-app payments without going
// through the natural funnel.
const OVERRIDE_STATUSES = [
  { value: 'unpaid', label: 'Unpaid', hint: 'Never paid' },
  { value: 'tikkied', label: 'Tikkied', hint: 'Clicked Tikkie link' },
  { value: 'pending_confirmation', label: 'Paid', hint: 'Player says they paid' },
  { value: 'paid', label: 'Confirmed', hint: 'Admin verified' },
  { value: 'transferred', label: 'Transferred', hint: 'Gave up their spot' },
]

function StatusOverrideMenu({
  currentStatus,
  onSelect,
}: {
  currentStatus: string | null | undefined
  onSelect: (status: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <IconButton onClick={() => setOpen(!open)} aria-label="More payment options" size="sm">
        <MoreVertical size={14} />
      </IconButton>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-50 min-w-[190px] overflow-hidden">
            <div className="px-3 py-1.5 text-[10px] font-bold text-lob-muted-light uppercase tracking-wider bg-gray-50">
              Set status
            </div>
            {OVERRIDE_STATUSES.map((s) => {
              const isCurrent = s.value === currentStatus
              return (
                <button
                  key={s.value}
                  onClick={() => {
                    if (!isCurrent) onSelect(s.value)
                    setOpen(false)
                  }}
                  disabled={isCurrent}
                  className={`w-full text-left px-3 py-2 text-sm font-medium transition-all ${
                    isCurrent
                      ? 'bg-gray-50 text-lob-muted-light cursor-default'
                      : 'text-lob-slate hover:bg-gray-50 active:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{s.label}</span>
                    {isCurrent && (
                      <span className="text-[10px] text-lob-muted-light">· current</span>
                    )}
                  </div>
                  <p className="text-[10px] text-lob-muted-light leading-tight">{s.hint}</p>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
