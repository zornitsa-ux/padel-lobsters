import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useApp } from '../../../context/useApp'
import { useMyProfile, usePlayerActions } from '../../players/usePlayers'
import {
  ProfileContactFields,
  ProfileNameFields,
  ProfilePlayFields,
} from '../../players/ProfileFields'
import {
  formFromPlayer,
  playerInputFromForm,
  profileProblem,
  type ProfileFieldValues,
} from '../../players/profileForm'
import { errorMessage } from '../../../lib/errors'
import {
  useAcknowledgeMyAccount,
  useMyAccountSetup,
  useMyTeamInvites,
  useTeamActions,
} from '../teams/useTeams'
import { useConfirmDecline } from '../registration/team/useConfirmDecline'
import { ACCOUNT_ACKNOWLEDGEMENT_LABEL, accountCreatedMessage } from '../teams/teamStatusMessages'
import { TEAM_INVITES_PATH } from './inviteRoutes'
import { Button } from '../../../components/ui/Button'

const EMPTY: ProfileFieldValues = {
  firstName: '',
  lastName: '',
  country: '',
  gender: '',
  isLeftHanded: false,
  preferredPosition: '',
  playtomicLevel: '',
  phone: '',
  birthday: '',
}

// First sign-in of an account a captain created (D-021): the player completes
// their profile and confirms the account is theirs before anything else, or
// says they're not playing without claiming it (D-022).
export default function FinishAccountPage() {
  const { session, role, logout } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const playerId = session?.user?.id ?? null
  const { data: setup, isPending: setupPending } = useMyAccountSetup({ enabled: !!playerId })
  const profile = useMyProfile(playerId)
  const { updatePlayer } = usePlayerActions({ session, role })
  const acknowledge = useAcknowledgeMyAccount()
  const { data: invites = [] } = useMyTeamInvites({ enabled: !!playerId })
  const { respondToTeamInvite } = useTeamActions()
  const confirmDecline = useConfirmDecline()
  const [leaving, setLeaving] = useState(false)
  const [form, setForm] = useState<ProfileFieldValues>(EMPTY)
  const [seeded, setSeeded] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (seeded || !profile.data) return
    setForm(formFromPlayer({ player: profile.data }))
    setSeeded(true)
  }, [profile.data, seeded])

  if (!playerId) return <Navigate to="/account" replace />
  if (setupPending || profile.isLoading) return null
  if (!setup || setup.acknowledged) {
    return <Navigate to={TEAM_INVITES_PATH} state={location.state} replace />
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const problem = profileProblem({ form })
    if (problem) {
      setError(problem)
      return
    }
    setSaving(true)
    setError('')
    try {
      await updatePlayer(playerId, playerInputFromForm({ form }))
      await acknowledge()
      navigate(TEAM_INVITES_PATH, { state: location.state, replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Could not save your account. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  const notPlaying = async () => {
    const declining = invites.length > 0
    if (
      declining &&
      !(await confirmDecline({ captainName: setup.requestedByName, signsOut: true }))
    )
      return
    setLeaving(true)
    const statuses = await Promise.all(
      invites.map((i) =>
        respondToTeamInvite({ tournamentId: i.tournamentId, teamId: i.teamId, accept: false }),
      ),
    )
    if (statuses.some((s) => s !== 'declined')) {
      setLeaving(false)
      return
    }
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="pt-5 space-y-4">
      <div className="card space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-lob-teal">
          Finish your account
        </p>
        <h2 className="text-lg font-bold text-lob-dark leading-snug">Welcome to Padel Lobsters</h2>
        <p className="text-sm text-lob-slate leading-relaxed">
          {accountCreatedMessage({
            requestedByName: setup.requestedByName,
            tournamentName: setup.tournamentName,
            email: session?.user?.email ?? '',
          })}
        </p>
      </div>

      <div className="card space-y-4">
        <ProfileNameFields form={form} setForm={setForm} />
        <ProfilePlayFields form={form} setForm={setForm} />
        <ProfileContactFields form={form} setForm={setForm} />
      </div>

      <div className="card space-y-4">
        <label className="flex items-start gap-3 text-sm text-lob-slate leading-relaxed">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 flex-shrink-0"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>{ACCOUNT_ACKNOWLEDGEMENT_LABEL}</span>
        </label>
        {error && (
          <p role="alert" className="text-xs text-lob-danger bg-lob-danger-light rounded-lg p-2">
            {error}
          </p>
        )}
        <Button type="submit" disabled={!confirmed || saving} className="w-full">
          {saving && <Loader2 size={14} className="animate-spin" />}
          Finish and see your invite
        </Button>
      </div>

      <NotPlayingCard
        captainName={setup.requestedByName}
        hasInvites={invites.length > 0}
        busy={leaving}
        onLeave={() => void notPlaying()}
      />
    </form>
  )
}

function NotPlayingCard({
  captainName,
  hasInvites,
  busy,
  onLeave,
}: {
  captainName: string
  hasInvites: boolean
  busy: boolean
  onLeave: () => void
}) {
  return (
    <div className="card space-y-3">
      <p className="text-sm font-semibold text-lob-dark">
        {hasInvites ? 'Not playing, or not your account?' : 'Not your account?'}
      </p>
      <p className="text-sm text-lob-slate leading-relaxed">
        {hasInvites
          ? `You can say no without setting anything up. ${captainName}'s team is cancelled and you're signed out.`
          : 'You can sign out without setting anything up.'}
      </p>
      <Button onClick={onLeave} disabled={busy} variant="secondary" className="w-full">
        {busy && <Loader2 size={14} className="animate-spin" />}
        {hasInvites ? "I'm not playing" : 'Sign out'}
      </Button>
    </div>
  )
}
