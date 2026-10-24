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
import { useAcknowledgeMyAccount, useMyAccountSetup } from '../teams/useTeams'
import { ACCOUNT_ACKNOWLEDGEMENT_LABEL, accountCreatedMessage } from '../teams/teamStatusMessages'
import { TEAM_INVITES_PATH } from './inviteRoutes'

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
// their profile and confirms the account is theirs before anything else.
export default function FinishAccountPage() {
  const { session, role } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const playerId = session?.user?.id ?? null
  const { data: setup, isPending: setupPending } = useMyAccountSetup({ enabled: !!playerId })
  const profile = useMyProfile(playerId)
  const { updatePlayer } = usePlayerActions({ session, role })
  const acknowledge = useAcknowledgeMyAccount()
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
          <p role="alert" className="text-xs text-red-600 bg-red-50 rounded-lg p-2">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!confirmed || saving}
          className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Finish and see your invite
        </button>
      </div>
    </form>
  )
}
