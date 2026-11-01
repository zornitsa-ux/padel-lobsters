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
  ChevronDown,
  MessageCircle,
} from 'lucide-react'
import { fmtEur } from '../../lib/format'
import { useConfirmOnBehalf } from '../../lib/confirmOnBehalf'
import { paymentChangeConfirm } from './paymentChangeConfirm'
import { EmptyState } from '../../components/ui/EmptyState'
import { AlertBox } from '../../components/ui/AlertBox'
import { Spinner } from '../../components/ui/Spinner'
import { IconButton } from '../../components/ui/IconButton'
import { Menu, MenuItem } from '../../components/ui/Menu'
import { PlayerRow } from '../../components/ui/PlayerRow'
import { ListCard, ListRow } from '../../components/ui/ListCard'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { StatTile } from '../../components/ui/StatTile'
import { Section } from '../../components/ui/Section'
import PaymentReminderModal from './PaymentReminderModal'
import { useTeamEntries } from './teams/useTeams'
import { buildPaymentRows } from './payments/teamPaymentRows'
import { pricePerEntry, type EventNavigate } from './eventHelpers'
import type { NormalisedTournament } from '../../lib/normalise'
import type { NormalisedRegistration } from './registrationQueries'
import { Button } from '../../components/ui/Button'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import {
  PAYMENT_STATUSES,
  PAYMENT_STATUS_INFO,
  isSettled,
  isUnpaid,
  paymentStatusInfo,
  toPaymentStatus,
} from './paymentStatus'
import PaymentStatusBadge from './registration/PaymentStatusBadge'
import { BADGE_TONE_CLASSES } from '../../components/ui/badgeTones'

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
        icon={<AlertCircle />}
        title="No event selected"
        action={<Button onClick={() => onNavigate('tournament')}>Go to Events</Button>}
      />
    )
  }

  // Without the team list every team would drop out and read as nothing owed.
  if (teamMode && teamsFailed) {
    return (
      <AlertBox variant="error">
        Couldn&apos;t load the teams. Open Payments again to retry.
      </AlertBox>
    )
  }
  if (teamMode && teamsPending) return <Spinner label="Loading teams…" />

  const { regs, partnerIdByRegId } = buildPaymentRows({
    teamMode,
    registrations: regsData,
    teamEntries,
  })
  // Status buckets; labels and meanings in ./paymentStatus.
  const confirmed = regs.filter((r) => isSettled(r.paymentStatus))
  const selfPaid = regs.filter((r) => r.paymentStatus === 'pending_confirmation')
  const tikkied = regs.filter((r) => r.paymentStatus === 'tikkied')
  // True "ghost" unpaid — didn't even click the Tikkie link
  const trulyUnpaid = regs.filter((r) => isUnpaid(r.paymentStatus))

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
    { value: 'unpaid', label: PAYMENT_STATUS_INFO.unpaid.label, count: trulyUnpaid.length },
    { value: 'tikkied', label: PAYMENT_STATUS_INFO.tikkied.label, count: tikkied.length },
    {
      value: 'pending',
      label: PAYMENT_STATUS_INFO.pending_confirmation.label,
      count: selfPaid.length,
    },
    { value: 'paid', label: PAYMENT_STATUS_INFO.paid.label, count: confirmed.length },
  ]

  const confirmPaymentChange = ({ reg, change }: { reg: NormalisedRegistration; change: string }) =>
    confirmOnBehalf(
      paymentChangeConfirm({ name: rowName(reg, getPlayer(reg.playerId)?.name ?? ''), change }),
    )

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
    const label = PAYMENT_STATUS_INFO[toPaymentStatus(status)].label
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
      <Section title="Admin booked all courts" icon={<ShieldCheck />}>
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
        {tournament.tikkieLink ? (
          <Button href={tournament.tikkieLink} external icon={<ExternalLink />}>
            Pay via Tikkie
          </Button>
        ) : (
          <p className="text-xs text-lob-muted">
            No Tikkie link set — payment via Playtomic or cash
          </p>
        )}
      </Section>

      {/* Summary */}
      <div className="bg-lob-teal rounded-2xl p-4 text-white shadow-lg">
        <div className="grid grid-cols-4 gap-2 mb-4">
          <StatTile
            value={confirmed.length}
            label={PAYMENT_STATUS_INFO.paid.label}
            size="md"
            labelVariant="inverted"
            valueClassName="text-lob-success-on-dark"
          />
          <StatTile
            value={selfPaid.length}
            label={PAYMENT_STATUS_INFO.pending_confirmation.label}
            size="md"
            labelVariant="inverted"
            valueClassName="text-lob-info-on-dark"
          />
          <StatTile
            value={tikkied.length}
            label={PAYMENT_STATUS_INFO.tikkied.label}
            size="md"
            labelVariant="inverted"
            valueClassName="text-lob-warning-on-dark"
          />
          <StatTile
            value={trulyUnpaid.length}
            label={PAYMENT_STATUS_INFO.unpaid.label}
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
              fillClassName="bg-lob-success-on-dark"
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

      {filtered.length === 0 ? (
        <EmptyState icon={<CheckCircle />} title={teamMode ? 'No teams here' : 'No players here'} />
      ) : (
        <ListCard label={teamMode ? 'Team payments' : 'Player payments'}>
          {filtered.map((reg) => {
            const player = getPlayer(reg.playerId)
            if (!player) return null
            const ps = reg.paymentStatus
            const isConfirmed = isSettled(ps)
            const isSelfPaid = ps === 'pending_confirmation'
            const isTikkied = ps === 'tikkied'
            const isTransferred = ps === 'transferred'
            const method =
              METHODS.find((m) => m.value === reg.paymentMethod)?.label || reg.paymentMethod
            const detail = ps === 'paid' ? method : isSelfPaid ? 'self-declared' : ''

            const { tone } = paymentStatusInfo(ps)

            return (
              <ListRow key={reg.id}>
                <PlayerRow
                  player={player}
                  avatarSize="lg"
                  avatarTone={BADGE_TONE_CLASSES[tone]}
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
                              setReminderTarget({
                                regId: reg.id,
                                name: player.name || 'this player',
                              })
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
                    <PaymentStatusBadge paymentStatus={ps} detail={detail || undefined} />
                    {costPerEntry > 0 && !isTransferred && (
                      <span className="text-xs text-lob-muted">{fmtEur(costPerEntry)}</span>
                    )}
                  </div>
                </PlayerRow>
              </ListRow>
            )
          })}
        </ListCard>
      )}

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
        <Button size="sm" trailingIcon={<ChevronDown />} {...props}>
          Mark Paid
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
      {PAYMENT_STATUSES.map((s) => (
        <MenuItem
          key={s}
          current={s === toPaymentStatus(currentStatus)}
          hint={PAYMENT_STATUS_INFO[s].hint}
          onSelect={() => onSelect(s)}
        >
          {PAYMENT_STATUS_INFO[s].label}
        </MenuItem>
      ))}
    </Menu>
  )
}
