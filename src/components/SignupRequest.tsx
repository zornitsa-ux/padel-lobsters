import React, { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { usePlayers } from '../features/players/usePlayers'
import { setOwnAvatar } from '../features/players/playerQueries'
import { playerKeys } from '../features/players/playerKeys'
import type { Player } from '../lib/normalise'
import { processAvatar } from '../lib/processAvatar'
import { ArrowLeft, UserPlus, Loader2 } from 'lucide-react'
import { AvatarPicker } from './ui/AvatarPicker'
import {
  ProfileContactFields,
  ProfileNameFields,
  ProfilePlayFields,
} from '../features/players/ProfileFields'
import { fullName, profileProblem, type ProfileFieldValues } from '../features/players/profileForm'
import { requestEmailCode, normaliseEmail } from '../features/auth/authActions'
import { OtpCodeStep } from '../features/auth/OtpCodeStep'
import { confirmedJustNow } from '../features/auth/newAccount'
import { takeReturnPath } from '../features/auth/returnPath'
import { buildSignupMetadata } from '../features/auth/signupMetadata'
import {
  describeSignupError,
  SIGNUP_HOOK_MESSAGES,
  type SignupField,
} from '../features/auth/signupErrors'
import { Button } from './ui/Button'
import { TextButton } from './ui/TextButton'
import { AlertBox } from './ui/AlertBox'

// =============================================================================
//  SignupRequest — the self-serve "Join the Lobsters" form shown inside the
//  VerificationGate (guest signup) and reachable as a standalone page.
//
//  Aligned with the in-app "Join" form (Players.jsx) so the screen is
//  identical whether the user is a first-time visitor or a signed-in player
//  inviting a new member. Same fields, same validation, same visual grammar.
//  After this change the in-app Join entry point is removed — this is now
//  the single code path for creating a new player profile.
//
//  Flow:
//    1. User fills the full profile (first/last name, country, gender,
//       hand, preferred side, Playtomic level, email,
//       phone, birthday, rotating "lobby prompt" note).
//    2. If the typed full name matches a placeholder (a teammate an admin
//       entered by name), signup is blocked: placeholders are activated only
//       through the admin invite, so an admin confirms who takes the profile.
//       the hook enforces the same rule. A match on an active
//       player points them to sign-in, or "I'm a different person".
//    3. Submit calls signInWithOtp (shouldCreateUser) with the profile as
//       user_metadata. The before_user_created hook validates it; its
//       rejections show next to the field they name.
//    4. The player types the emailed code (OtpCodeStep). Confirming the email
//       creates the players row.
//    5. The optional photo is uploaded after sign-in: storage RLS only lets
//       a player write player-<own id>.webp.
//
//  Props:
//    onComplete?(role)  — called after the code is verified. The gate
//                         uses this to dismiss itself; a standalone page
//                         uses it to navigate.
//    onBack?()          — called if the user cancels. Optional.
//    compact?           — bool. Tightens padding when embedded in the gate.
// =============================================================================

// Rotating fun prompts for the "notes" field shown on the form. Kept in
// sync with the copy originally used by Players.jsx so new signups see
// the same vibe.
const LOBBY_PROMPTS = [
  { label: '🎤 Trash Talk', placeholder: 'Say something to your future opponents…' },
  { label: '🦞 Lobster Confession', placeholder: 'Confess your deepest padel sin…' },
  { label: '💬 War Cry', placeholder: 'What do you scream before a match?' },
  { label: '🏅 Bold Claim', placeholder: 'Make a promise you may not keep…' },
  { label: '🎯 Battle Cry', placeholder: 'Inspire (or scare) your opponents…' },
  { label: '😤 Excuse Generator', placeholder: 'Pre-write your excuse for losing today…' },
  { label: '🤝 Personal Pledge', placeholder: 'What do you bring to the court?' },
  { label: '👀 Scouting Report', placeholder: 'Describe your playing style in one line…' },
]
const randomPrompt = () => LOBBY_PROMPTS[Math.floor(Math.random() * LOBBY_PROMPTS.length)]

// Same normalisation the hook applies when matching a placeholder.
const normName = (name: string | null | undefined) =>
  (name || '').trim().replace(/\s+/g, ' ').toLowerCase()

const findNameMatch = ({ players, name }: { players: Player[]; name: string }) => {
  const typed = normName(name)
  if (typed.split(' ').length < 2) return null
  return players.find((p) => normName(p.name) === typed) ?? null
}

const isPlaceholder = (p: Player | null | undefined) => p?.status === 'placeholder'

const PLACEHOLDER_INVITE_TEXT = SIGNUP_HOOK_MESSAGES.placeholder

// Runs after sign-in, possibly after this form has unmounted. A failure only
// costs the photo; the player can add it from their profile.
async function uploadSignupAvatar({ playerId, file }: { playerId: string; file: File }) {
  try {
    await setOwnAvatar({ playerId, file: await processAvatar(file) })
    return true
  } catch (err) {
    console.error('Avatar upload after signup failed:', err)
    return false
  }
}

interface SignupFormState extends ProfileFieldValues {
  email: string
  notes: string
  avatarUrl: string
}

const emptyForm: SignupFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  playtomicLevel: '',
  notes: '',
  gender: '',
  isLeftHanded: false,
  country: '',
  avatarUrl: '',
  birthday: '',
  preferredPosition: '',
}

interface SignupRequestProps {
  onComplete?: (role: string) => void
  onBack?: () => void
  compact?: boolean
}

export default function SignupRequest({ onComplete, onBack, compact = false }: SignupRequestProps) {
  const { data: players = [] } = usePlayers()
  const queryClient = useQueryClient()

  const [form, setForm] = useState(emptyForm)
  // useState's lazy initializer rolls a prompt on first mount, but in
  // rare cases (hot reload, fast refresh, parent preserving an instance
  // across guest signups) the same prompt can stick. The effect below
  // guarantees a fresh roll on every mount — paired with a `key` bump
  // in VerificationGate that forces a fresh mount each time the user
  // enters signup, two different Lobsters should very rarely see the
  // same tagline in a row.
  const [lobbyPrompt, setLobbyPrompt] = useState(randomPrompt)
  useEffect(() => {
    setLobbyPrompt(randomPrompt())
  }, [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<SignupField, string>>>({})

  // Name-match state. `nameMatch` is the roster row whose name equals the
  // typed one (drives the banner); `declinedId` is an active match the user
  // said is someone else, so the submit-time check stops re-raising it.
  const [nameMatch, setNameMatch] = useState<Player | null>(null)
  const [declinedId, setDeclinedId] = useState<string | null>(null)

  // Avatar state — file is uploaded after sign-in, preview is the dataURL
  // so the user sees their pick immediately.
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  // Set once the code is on its way; the form state is kept for "Change email".
  const [awaitingCode, setAwaitingCode] = useState(false)

  const combinedName = fullName({ form })
  // Placeholder matches can't be dismissed; only an admin invite resolves them.
  const unresolvedMatch = (p: Player | null) =>
    p && (isPlaceholder(p) || p.id !== declinedId) ? p : null
  const bannerMatch = unresolvedMatch(nameMatch)

  // Debounced so the banner doesn't flicker while the user is typing.
  const matchDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    clearTimeout(matchDebounceRef.current)
    matchDebounceRef.current = setTimeout(() => {
      setNameMatch(findNameMatch({ players, name: combinedName }))
    }, 400)
    return () => clearTimeout(matchDebounceRef.current)
  }, [combinedName, players])

  const declineMatch = () => {
    setDeclinedId(nameMatch?.id ?? null)
    setNameMatch(null)
    setError('')
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result
      setAvatarPreview(typeof result === 'string' ? result : null)
    }
    reader.readAsDataURL(file)
  }

  const validate = (): string => profileProblem({ form, email: form.email })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setError('')

    // Never create a second row for a name already on the roster unless the
    // user has said it isn't them (not allowed for placeholders).
    const pending = unresolvedMatch(findNameMatch({ players, name: combinedName }))
    if (pending) {
      setNameMatch(pending)
      return
    }

    const invalid = validate()
    if (invalid) {
      setError(invalid)
      return
    }

    setSaving(true)
    setFieldErrors({})
    const { error: signupError } = await requestSignupCode()
    setSaving(false)
    if (!signupError) {
      setAwaitingCode(true)
      return
    }
    const view = describeSignupError({ error: signupError })
    if (view.field) setFieldErrors({ [view.field]: view.message })
    else setError(view.message)
  }

  const signupMetadata = () =>
    buildSignupMetadata({
      profile: {
        name: combinedName,
        phone: form.phone,
        playtomicLevel: form.playtomicLevel,
        gender: form.gender,
        isLeftHanded: form.isLeftHanded,
        country: form.country,
        birthday: form.birthday,
        preferredPosition: form.preferredPosition,
        taglineLabel: lobbyPrompt.label,
        notes: form.notes,
      },
    })

  const requestSignupCode = () =>
    requestEmailCode({
      email: normaliseEmail(form.email),
      shouldCreateUser: true,
      data: signupMetadata(),
    })

  const handleVerified = (session: Session) => {
    void queryClient.invalidateQueries({ queryKey: playerKeys.all() })
    takeReturnPath()
    // GoTrue signs an existing account in on this path: never overwrite its photo.
    if (avatarFile && confirmedJustNow({ emailConfirmedAt: session.user.email_confirmed_at })) {
      void uploadSignupAvatar({ playerId: session.user.id, file: avatarFile }).then((ok) => {
        if (ok) void queryClient.invalidateQueries({ queryKey: playerKeys.all() })
      })
    }
    onComplete?.('player')
  }

  // ── Code step — the email is confirmed, and the players row created, on verify ──
  if (awaitingCode) {
    return (
      <div className={`space-y-4 ${compact ? '' : 'max-w-md mx-auto p-4'}`}>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-lob-line space-y-4">
          <h1 className="text-lg font-extrabold text-lob-dark">Confirm your email 🦞</h1>
          <OtpCodeStep
            email={normaliseEmail(form.email)}
            submitLabel="Finish signing up"
            onVerified={handleVerified}
            onChangeEmail={() => setAwaitingCode(false)}
            resend={requestSignupCode}
          />
        </div>
      </div>
    )
  }

  // ── Default (form) state — rich profile form mirroring Players.jsx ────────
  return (
    <div className={`space-y-3 ${compact ? '' : 'max-w-md mx-auto p-4'}`}>
      {onBack && (
        <TextButton tone="neutral" size="sm" icon={<ArrowLeft size={14} />} onClick={onBack}>
          Back to sign in
        </TextButton>
      )}

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-lob-line space-y-4">
        <header className="space-y-1">
          <h1 className="text-lg font-extrabold text-lob-dark flex items-center gap-2">
            <UserPlus size={18} className="text-lob-teal" />
            Join the Lobsters 🦞
          </h1>
          <p className="text-xs text-lob-muted leading-snug">
            We'll email you a 6-digit code to confirm your address. Fill in the full profile — it
            powers matchmaking, your Lobster Review, and the leaderboards.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar — optional, but the same slot the in-app form offered. */}
          <AvatarPicker preview={avatarPreview} onChange={handleAvatarChange} />

          <ProfileNameFields form={form} setForm={setForm} />

          {bannerMatch && (
            <NameMatchBanner match={bannerMatch} onSignIn={onBack} onDecline={declineMatch} />
          )}
          {fieldErrors.name && (
            <p role="alert" className="text-xs text-lob-danger bg-lob-danger-light rounded-lg p-2">
              {fieldErrors.name}
            </p>
          )}

          <ProfilePlayFields form={form} setForm={setForm} levelError={fieldErrors.level} />

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              placeholder="player@email.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <p className="text-xs text-lob-muted-light mt-1">Visible for organizers only</p>
          </div>

          <ProfileContactFields form={form} setForm={setForm} />

          <div>
            <label className="label">{lobbyPrompt.label}</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder={lobbyPrompt.placeholder}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          {error && (
            <AlertBox variant="error" size="sm">
              {error}
            </AlertBox>
          )}

          <Button
            type="submit"
            disabled={saving}
            fullWidth
            icon={saving ? <Loader2 className="animate-spin" /> : <UserPlus />}
          >
            {saving ? 'Saving…' : 'Join the Lobsters 🦞'}
          </Button>
        </form>
      </div>
    </div>
  )
}

// Shown when the typed full name is already on the roster. A placeholder is
// activated only by an admin invite; an active profile's owner should sign in.
function NameMatchBanner({
  match,
  onSignIn,
  onDecline,
}: {
  match: Player
  onSignIn?: () => void
  onDecline: () => void
}) {
  const needsInvite = isPlaceholder(match)
  return (
    <AlertBox
      variant="warning"
      title={
        needsInvite ? 'Your profile is waiting for an invite' : 'This name already has a profile'
      }
      actions={
        (onSignIn || !needsInvite) && (
          <div className="space-y-3">
            {onSignIn && (
              <Button fullWidth onClick={onSignIn}>
                {needsInvite ? 'Back to sign in' : 'Go to sign in'}
              </Button>
            )}
            {!needsInvite && (
              <div className="text-center">
                <TextButton tone="warning" onClick={onDecline}>
                  No, I’m a different person
                </TextButton>
              </div>
            )}
          </div>
        )
      }
    >
      {needsInvite
        ? PLACEHOLDER_INVITE_TEXT
        : `If you’re ${match.name}, go back and sign in with your email.`}
    </AlertBox>
  )
}
