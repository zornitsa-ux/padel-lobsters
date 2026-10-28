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
import { useConfirmOnBehalf } from '../../lib/confirmOnBehalf'
import { EmptyState } from '../../components/ui/EmptyState'
import { IconButton } from '../../components/ui/IconButton'
import { Menu, MenuItem } from '../../components/ui/Menu'
import { PlayerRow } from '../../components/ui/PlayerRow'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { StatTile } from '../../components/ui/StatTile'
import PaymentReminderModal from './PaymentReminderModal'
import { useTeamEntries } from './teams/useTeams'
import { buildPaymentRows } from './payments/teamPaymentRows'
import { pricePerEntry, type EventNavigate } from './eventHelpers'
import type { NormalisedTournament } from '../../lib/normalise'
import type { NormalisedRegistration } from './registrationQueries'
import { Button } from '../../components/ui/Button'
import { SegmentedControl } from '../../components/ui/SegmentedControl'

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
  const { isAdmin } = useApp()
  const confirmOnBehalf = useConfirmOnBehalf()
  const { updateRegistration } = useRegistrationActions()
  const { data: players = [] } = usePlayers()
  const { data: regsData = [] } = useRegistrations(tournament?.id)
  const teamMode = tournament?.entryMode === 'team'
  const {
    entries: teamEntries,
    isPending: teamsPending,
    isError: teamsFailed,
  } = useTeamEntries({ tournamentId: tournament?.id, registrations: regsData, enabled: teamMode })
  const [filter, setFilter] = useState<PaymentFilter>('all')
  const [reminderTarget, setReminderTarget] = useState<{ regId: string; name: string } | null>(null)

  if (!tournament) {
    return (
      <EmptyState
        icon={<AlertCircle size={36} />}
        title="No event selected"
        action={<Button onClick={() => onNavigate('tournament')}>Go to Events</Button>}
      />
    )
  }

  // Without the team list every team would drop out and read as nothing owed.
  if (teamMode && (teamsPending || teamsFailed)) {
    return (
      <EmptyState
        icon={<AlertCircle size={36} />}
        title={teamsFailed ? "Couldn't load the teams" : 'Loading teams…'}
        description={teamsFailed ? 'Open Payments again to retry.' : undefined}
      />
    )
  }

  const { regs, partnerIdByRegId } = buildPaymentRows({
    teamMode,
    registrations: regsData,
    teamEntries,
  })
  // Status buckets — see Registration.jsx PayBadge for semantics.
  const confirmed = regs.filter(
    (r) => r.paymentStatus === 'paid' || r.paymentStatus === 'transferred',
  )
  const selfPaid = regs.filter((r) => r.paymentStatus === 'pending_confirmation')
  const tikkied = regs.filter((r) => r.paymentStatus === 'tikkied')
  // True "ghost" unpaid — didn't even click the Tikkie link
  const trulyUnpaid = regs.filter((r) => !r.paymentStatus || r.paymentStatus === 'unpaid')

  // One row per signup: a player, or a team through its captain.
  const costPerEntry = pricePerEntry(tournament)
  const unitLabel = teamMode ? 'team' : 'player'

  const totalCollected = confirmed.length * costPerEntry
  const totalExpected = regs.length * costPerEntry

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
  const rowName = (reg: NormalisedRegistration, captainName: string) => {
    const partnerId = partnerIdByRegId.get(reg.id)
    const partnerName = partnerId ? getPlayer(partnerId)?.name : null
    return partnerName ? `${captainName} & ${partnerName}` : captainName
  }

  // Order follows the payment funnel: everyone → unpaid (never clicked) →
  // tikkied → paid (self-declared) → confirmed (admin verified).
  const filterTabs: { value: PaymentFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: regs.length },
    { value: 'unpaid', label: 'Unpaid', count: trulyUnpaid.length },
    { value: 'tikkied', label: 'Tikkied', count: tikkied.length },
    { value: 'pending', label: 'Paid', count: selfPaid.length },
    { value: 'paid', label: 'Confirmed', count: confirmed.length },
  ]

  const confirmPaymentChange = ({ reg, change }: { reg: NormalisedRegistration; change: string }) =>
    confirmOnBehalf({
      title: 'Update payment?',
      lines: [`Player: ${rowName(reg, getPlayer(reg.playerId)?.name ?? '')}`, `Change: ${change}`],
      confirmLabel: 'Update payment',
      footer: 'Check this is the right payment before you continue.',
    })

  const handleMarkPaid = async (reg: NormalisedRegistration, method: string) => {
    if (!isAdmin) {
      onNavigate?.('settings')
      return
    }
    if (!(await confirmPaymentChange({ reg, change: `Mark as paid (${method})` }))) return
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
    if (!(await confirmPaymentChange({ reg, change: 'Mark as unpaid' }))) return
    await updateRegistration(reg.id, { paymentStatus: 'unpaid', paymentMethod: '' }, tournament.id)
  }

  // Manual status override — admin can jump to any state regardless of the
  // natural flow (for bookkeeping fixes, correcting miscicks, etc.)
  const handleSetStatus = async (reg: NormalisedRegistration, status: string) => {
    if (!isAdmin) {
      onNavigate?.('settings')
      return
    }
    const label = OVERRIDE_STATUSES.find((s) => s.value === status)?.label ?? status
    if (!(await confirmPaymentChange({ reg, change: `Set status to ${label}` }))) return
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
            · Per {unitLabel}:{' '}
            <span className="font-bold text-lob-teal">{fmtEur(costPerEntry)}</span>
            <span className="text-xs text-lob-muted-light">
              {' '}
              (÷ {tournament.maxPlayers} players{teamMode ? ', 2 per team' : ''})
            </span>
          </p>
        )}
        {tournament.tikkieLink && (
          <Button href={tournament.tikkieLink} external icon={<ExternalLink />}>
            Pay via Tikkie
          </Button>
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
            valueClassName="text-lob-success-on-dark"
          />
          <StatTile
            value={selfPaid.length}
            label="Paid"
            size="md"
            labelVariant="inverted"
            valueClassName="text-lob-info-on-dark"
          />
          <StatTile
            value={tikkied.length}
            label="Tikkied"
            size="md"
            labelVariant="inverted"
            valueClassName="text-lob-warning-on-dark"
          />
          <StatTile
            value={trulyUnpaid.length}
            label="Unpaid"
            size="md"
            labelVariant="inverted"
            valueClassName="text-lob-danger-on-dark"
          />
        </div>

        {costPerEntry > 0 && (
          <div className="bg-white/10 rounded-xl p-3">
            <div className="flex justify-between text-sm mb-1">
              <span className="opacity-80">Cost per {unitLabel}</span>
              <span className="font-bold">{fmtEur(costPerEntry)}</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span className="opacity-80">Collected</span>
              <span className="font-bold text-lob-success-on-dark">{fmtEur(totalCollected)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="opacity-80">Still owed</span>
              <span className="font-bold text-lob-danger-on-dark">
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

      <SegmentedControl
        ariaLabel="Payment status"
        layout="scroll"
        options={filterTabs}
        value={filter}
        onChange={setFilter}
      />

      {/* Payment list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <EmptyState
            icon={<CheckCircle size={28} />}
            title={teamMode ? 'No teams here' : 'No players here'}
          />
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
            ? 'border-lob-success-solid'
            : isSelfPaid
              ? 'border-lob-info-solid'
              : isTikkied
                ? 'border-lob-warning-solid'
                : 'border-lob-danger-border'
          const avatarColor = isConfirmed
            ? 'bg-lob-success-soft text-lob-success'
            : isSelfPaid
              ? 'bg-lob-info-soft text-lob-info'
              : isTikkied
                ? 'bg-lob-warning-soft text-lob-warning'
                : 'bg-lob-danger-soft text-lob-danger'

          return (
            <div key={reg.id} className={`card transition-all border-l-4 ${borderColor}`}>
              <PlayerRow
                player={player}
                avatarSize="lg"
                avatarTone={avatarColor}
                name={rowName(reg, player.name)}
                trailing={
                  isAdmin && (
                    <div className="flex items-center gap-1">
                      {/* Primary action — varies by status, keeps the most common
                          next step one tap away for the admin. */}
                      {isConfirmed ? (
                        <Button variant="neutral" size="sm" onClick={() => handleMarkUnpaid(reg)}>
                          Undo
                        </Button>
                      ) : isSelfPaid || isTikkied ? (
                        <Button
                          size="sm"
                          onClick={() => handleMarkPaid(reg, reg.paymentMethod || 'tikkie')}
                        >
                          Confirm ✓
                        </Button>
                      ) : (
                        <PaymentMethodPicker onSelect={(method) => handleMarkPaid(reg, method)} />
                      )}
                      {!!tournament.tikkieLink && !isConfirmed && !isSelfPaid && (
                        <Button
                          variant="neutral"
                          size="sm"
                          onClick={() =>
                            setReminderTarget({ regId: reg.id, name: player.name || 'this player' })
                          }
                          title="Send a WhatsApp payment reminder"
                          icon={<MessageCircle />}
                        >
                          Remind
                        </Button>
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
                    <span className="text-xs font-semibold bg-lob-success-soft text-lob-success px-2 py-0.5 rounded-full">
                      ✓ Confirmed{' '}
                      {reg.paymentMethod
                        ? `· ${METHODS.find((m) => m.value === reg.paymentMethod)?.label || reg.paymentMethod}`
                        : ''}
                    </span>
                  ) : isSelfPaid ? (
                    <span className="text-xs font-semibold bg-lob-info-soft text-lob-info px-2 py-0.5 rounded-full">
                      💬 Paid (self-declared)
                    </span>
                  ) : isTikkied ? (
                    <span className="text-xs font-semibold bg-lob-warning-soft text-lob-warning px-2 py-0.5 rounded-full">
                      🔗 Tikkied
                    </span>
                  ) : (
                    <span className="text-xs font-semibold bg-lob-coral-light text-lob-coral px-2 py-0.5 rounded-full">
                      ⚠ Unpaid
                    </span>
                  )}
                  {costPerEntry > 0 && !isTransferred && (
                    <span className="text-xs text-lob-muted">{fmtEur(costPerEntry)}</span>
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
          isTeam={teamMode}
          onClose={() => setReminderTarget(null)}
        />
      )}
    </div>
  )
}

function PaymentMethodPicker({ onSelect }: { onSelect: (method: string) => void }) {
  return (
    <Menu
      label="Payment method"
      trigger={(props) => (
        <Button size="sm" {...props}>
          Mark Paid ▾
        </Button>
      )}
    >
      {METHODS.map((m) => (
        <MenuItem key={m.value} onSelect={() => onSelect(m.value)}>
          {m.label}
        </MenuItem>
      ))}
    </Menu>
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
  return (
    <Menu
      label="Set status"
      showLabel
      trigger={(props) => (
        <IconButton {...props} aria-label="More payment options" size="sm">
          <MoreVertical />
        </IconButton>
      )}
    >
      {OVERRIDE_STATUSES.map((s) => (
        <MenuItem
          key={s.value}
          current={s.value === currentStatus}
          hint={s.hint}
          onSelect={() => onSelect(s.value)}
        >
          {s.label}
        </MenuItem>
      ))}
    </Menu>
  )
}
