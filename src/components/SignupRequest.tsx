import React, { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useApp } from '../context/useApp'
import { usePlayers } from '../features/players/usePlayers'
import { setOwnAvatar } from '../features/players/playerQueries'
import { playerKeys } from '../features/players/playerKeys'
import type { Player } from '../lib/normalise'
import { isE164 } from '../lib/whatsapp'
import { parseLevel } from '../lib/parseLevel'
import { processAvatar } from '../lib/processAvatar'
import { ArrowLeft, UserPlus, Check, Loader2, Copy, User, Camera } from 'lucide-react'
import CountryPicker from './ui/CountryPicker'
import { SegmentedControl } from './ui/SegmentedControl'

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
//       self_signup_player enforces the same rule. A match on an active
//       player points them to sign-in, or "I'm a different person".
//    3. Submit calls selfSignup and shows the PIN on a one-shot screen.
//       Signing in waits for "Continue" — the gate unmounts this screen as
//       soon as the role flips, so an automatic login would hide the PIN.
//    4. The optional photo is uploaded after sign-in: storage RLS only lets
//       a player write player-<own id>.webp.
//
//  Props:
//    onComplete?(role)  — called after successful auto-login. The gate
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

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

// Same normalisation self_signup_player applies when matching a placeholder.
const normName = (name: string | null | undefined) =>
  (name || '').trim().replace(/\s+/g, ' ').toLowerCase()

const findNameMatch = ({ players, name }: { players: Player[]; name: string }) => {
  const typed = normName(name)
  if (typed.split(' ').length < 2) return null
  return players.find((p) => normName(p.name) === typed) ?? null
}

const isPlaceholder = (p: Player | null | undefined) => p?.status === 'placeholder'

const PLACEHOLDER_INVITE_TEXT =
  'You’ve already been added to a Lobster team. To keep your profile safe, an admin needs to send you an invite — message an admin and they’ll email you your PIN.'

// `selfSignup` is typed `Promise<unknown>` by AppContext because it wraps the
// untyped auth API. Read the fields this form branches on off it rather
// than asserting a shape onto the whole payload.
function readSignupResult(result: unknown): {
  failed: boolean
  errorMessage: string
  wasExisting: boolean
  pin: string
  playerId: string
} {
  const root = isRecord(result) ? result : {}
  const payload = isRecord(root.data) ? root.data : null
  const error = isRecord(root.error) ? root.error : null
  return {
    failed: error !== null,
    errorMessage: typeof error?.message === 'string' ? error.message : '',
    wasExisting: payload?.was_existing === true,
    pin: typeof payload?.pin === 'string' ? payload.pin : '',
    playerId: typeof payload?.player_id === 'string' ? payload.player_id : '',
  }
}

// Messages raised by self_signup_player (see 20261012120000).
const SIGNUP_ERRORS: [string, string][] = [
  [
    'rate limited',
    "We've seen too many signups from this device today. Please try again tomorrow or ask an admin to add you.",
  ],
  ['placeholder needs invite', PLACEHOLDER_INVITE_TEXT],
  [
    'email in use',
    'This email is already linked to another Lobster profile. Please ask an admin to help you sign in.',
  ],
  ['invalid level', 'Playtomic level must be a number, e.g. 3.5.'],
]

const signupErrorText = (message: string) =>
  SIGNUP_ERRORS.find(([raised]) => message.includes(raised))?.[1] ||
  message ||
  'Could not create your profile — please try again.'

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

interface SignupFormState {
  firstName: string
  lastName: string
  email: string
  phone: string
  playtomicLevel: string
  notes: string
  gender: string
  isLeftHanded: boolean
  country: string
  avatarUrl: string
  birthday: string
  preferredPosition: string
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
  const { selfSignup, loginWithPin } = useApp()
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

  // Name-match state. `nameMatch` is the roster row whose name equals the
  // typed one (drives the banner); `declinedId` is an active match the user
  // said is someone else, so the submit-time check stops re-raising it.
  const [nameMatch, setNameMatch] = useState<Player | null>(null)
  const [declinedId, setDeclinedId] = useState<string | null>(null)

  // Avatar state — file is uploaded after sign-in, preview is the dataURL
  // so the user sees their pick immediately.
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Post-submit screen. When set we show the PIN reveal instead of the form.
  const [pinReveal, setPinReveal] = useState<{
    pin: string
    playerId: string
  } | null>(null)
  const [copied, setCopied] = useState(false)
  // Separate from the form's `saving` so a retry can't re-trigger form
  // submission logic.
  const [continuing, setContinuing] = useState(false)
  const [continueError, setContinueError] = useState('')

  const combinedName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim()
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

  const validate = (): string => {
    const missing = []
    if (!form.firstName.trim()) missing.push('First Name')
    if (!form.lastName.trim()) missing.push('Last Name')
    if (!form.country) missing.push('Country')
    if (!form.gender) missing.push('Gender')
    if (!form.email.trim()) missing.push('Email')
    if (!form.phone.trim()) missing.push('Phone / WhatsApp')
    if (!form.playtomicLevel.trim()) missing.push('Playtomic Level')
    if (missing.length > 0) return `Please complete: ${missing.join(', ')}`
    // E.164 so we can build wa.me links for transfer offers.
    if (!isE164(form.phone)) {
      return 'Phone must start with + and the country code (e.g. +31612345678).'
    }
    const level = parseLevel(form.playtomicLevel)
    if (level === null || level > 7)
      return 'Playtomic level must be a number from 0 to 7, e.g. 3.5.'
    return ''
  }

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
    try {
      const signup = readSignupResult(
        await selfSignup({
          name: combinedName,
          email: form.email.trim(),
          phone: form.phone.trim(),
          playtomicLevel: parseLevel(form.playtomicLevel) ?? 0,
          notes: form.notes || '',
          gender: form.gender || '',
          isLeftHanded: form.isLeftHanded || false,
          country: form.country || '',
          birthday: form.birthday || null,
          preferredPosition: form.preferredPosition || '',
          taglineLabel: lobbyPrompt.label,
        }),
      )
      if (signup.failed) {
        setError(signupErrorText(signup.errorMessage))
        return
      }
      if (signup.wasExisting) {
        // The RPC deliberately does NOT return the PIN to a stranger holding
        // the email — route the user to recovery instead.
        setError(
          'An account with this email already exists. Go back and use “Email me a sign-in link” to get in.',
        )
        return
      }
      if (!signup.pin || !signup.playerId) {
        setError(
          "Your profile was created but we couldn't read the PIN back. Please ask an admin to resend it.",
        )
        return
      }
      setPinReveal({ pin: signup.pin, playerId: signup.playerId })
    } catch (err) {
      console.error('Signup error:', err)
      setError('Something went wrong — please try again.')
    } finally {
      setSaving(false)
    }
  }

  const copyPin = async () => {
    try {
      await navigator.clipboard.writeText(pinReveal?.pin || '')
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* secure context etc. — PIN is visible in the callout */
    }
  }

  // "Continue to the app" — the one place a new player is signed in. Success
  // flips the role and the gate unmounts this form; failure stays here with
  // the PIN still on screen.
  const continueToApp = async () => {
    if (continuing) return
    const pin = pinReveal?.pin || ''
    if (!pin) return
    setContinuing(true)
    setContinueError('')
    try {
      const result = await loginWithPin(pin)
      if (result?.success) {
        if (avatarFile && pinReveal?.playerId) {
          void uploadSignupAvatar({ playerId: pinReveal.playerId, file: avatarFile }).then((ok) => {
            if (ok) void queryClient.invalidateQueries({ queryKey: playerKeys.all() })
          })
        }
        onComplete?.(result.role || 'player')
      } else {
        // `error` is typed unknown by AppContext; the auth API only ever puts
        // a string there.
        setContinueError(
          (typeof result?.error === 'string' ? result.error : '') ||
            "We couldn't sign you in automatically. Copy your PIN and try again from the sign-in screen.",
        )
      }
    } catch (err) {
      console.error('Continue retry failed:', err)
      setContinueError(
        "We couldn't reach the server. Copy your PIN and try again from the sign-in screen.",
      )
    } finally {
      setContinuing(false)
    }
  }

  // ── Success state — one-shot PIN reveal ──────────────────────
  if (pinReveal) {
    return (
      <div className={`space-y-4 ${compact ? '' : 'max-w-md mx-auto p-4'}`}>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center mx-auto">
              <Check className="text-lob-teal" size={24} />
            </div>
            <h1 className="text-lg font-extrabold text-lob-dark">You’re in 🦞</h1>
            <p className="text-sm text-lob-slate leading-snug">
              Your Lobster profile is ready. Save your PIN — you’ll need it next time.
            </p>
          </div>

          <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-lob-teal font-bold uppercase tracking-wide">
                Your PIN
              </div>
              <div className="text-2xl font-extrabold tracking-[0.4em] text-lob-teal">
                {pinReveal.pin || '????'}
              </div>
            </div>
            <button
              onClick={copyPin}
              className="text-xs font-semibold text-lob-teal hover:text-teal-700 flex items-center gap-1"
            >
              <Copy size={12} />
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <p className="text-[11px] text-lob-muted leading-snug">
            This PIN unlocks the app on any device. Save it in your password manager — we don't
            email or text it automatically.
          </p>

          {continueError && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{continueError}</p>
          )}

          <button
            onClick={continueToApp}
            disabled={continuing}
            className="w-full bg-lob-teal text-white font-bold text-sm py-2.5 rounded-xl hover:bg-teal-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {continuing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Signing in…
              </>
            ) : (
              <>Continue to the app →</>
            )}
          </button>
        </div>
      </div>
    )
  }

  // ── Default (form) state — rich profile form mirroring Players.jsx ────────
  return (
    <div className={`space-y-3 ${compact ? '' : 'max-w-md mx-auto p-4'}`}>
      {onBack && (
        <button
          onClick={onBack}
          className="text-sm text-lob-slate hover:text-lob-teal flex items-center gap-1"
          type="button"
        >
          <ArrowLeft size={14} /> Back to sign in
        </button>
      )}

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
        <header className="space-y-1">
          <h1 className="text-lg font-extrabold text-lob-dark flex items-center gap-2">
            <UserPlus size={18} className="text-lob-teal" />
            Join the Lobsters 🦞
          </h1>
          <p className="text-xs text-lob-muted leading-snug">
            You'll get an access PIN to use in the app. Fill in the full profile — it powers
            matchmaking, your Lobster Review, and the leaderboards.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar — optional, but the same slot the in-app form offered. */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Preview"
                  className="w-20 h-20 rounded-full object-cover border-2 border-lob-teal"
                />
              ) : (
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-lob-muted-light border-2 border-dashed border-gray-300">
                  <User size={28} />
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-7 h-7 bg-lob-teal rounded-full flex items-center justify-center text-white shadow-sm active:scale-95"
              >
                <Camera size={13} />
              </button>
            </div>
            <p className="text-xs text-lob-muted-light">Tap camera icon to add photo</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">First Name</label>
              <input
                required
                className="input"
                placeholder="e.g. Augustin"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Last Name</label>
              <input
                required
                className="input"
                placeholder="e.g. Tapia"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </div>
          </div>

          {bannerMatch && (
            <NameMatchBanner match={bannerMatch} onSignIn={onBack} onDecline={declineMatch} />
          )}

          <div>
            <label className="label">Country</label>
            <CountryPicker
              value={form.country}
              onChange={(val) => setForm((f) => ({ ...f, country: val }))}
            />
          </div>

          <div>
            <label className="label">Gender</label>
            <p className="text-xs text-lob-muted-light mb-2">For optimal pair matching</p>
            <SegmentedControl
              ariaLabel="Gender"
              options={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
              ]}
              value={form.gender}
              onChange={(val) => setForm((f) => ({ ...f, gender: f.gender === val ? '' : val }))}
            />
          </div>

          <div>
            <label className="label">Playing hand</label>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, isLeftHanded: !f.isLeftHanded }))}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all w-full justify-center ${
                form.isLeftHanded
                  ? 'bg-amber-100 text-amber-700 border-2 border-amber-300'
                  : 'bg-gray-100 text-lob-muted'
              }`}
            >
              🤚 {form.isLeftHanded ? 'Left-handed (tap to undo)' : 'Tap if left-handed'}
            </button>
          </div>

          <div>
            <label className="label">Preferred Side</label>
            <div className="flex gap-2">
              {[
                ['left', '👈 Left'],
                ['right', '👉 Right'],
                ['both', '↔️ Both'],
              ].map(([val, lbl]) => (
                <button
                  type="button"
                  key={val}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      preferredPosition: f.preferredPosition === val ? '' : val,
                    }))
                  }
                  className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-all ${
                    form.preferredPosition === val
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-lob-slate'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">
              Playtomic Level
            </p>
            <div>
              <label className="label">Playtomic Level (0–7)</label>
              <input
                type="text"
                inputMode="decimal"
                className="input"
                placeholder="e.g. 3.5"
                value={form.playtomicLevel}
                onChange={(e) => setForm((f) => ({ ...f, playtomicLevel: e.target.value }))}
              />
              <p className="text-xs text-lob-muted mt-1">
                Check your Playtomic app — it shows your current level. We use it to build balanced
                matches, and it improves as you play.
              </p>
            </div>
          </div>

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

          <div>
            <label className="label">Phone / WhatsApp</label>
            <input
              type="tel"
              className="input"
              placeholder="+31612345678"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <p className="text-xs text-lob-muted-light mt-1">
              Start with + and your country code, e.g. +31 for the Netherlands. Visible to
              organizers only.
            </p>
          </div>

          <div>
            <label className="label">Birthday 🎂</label>
            <input
              type="date"
              className="input"
              value={form.birthday || ''}
              onChange={(e) => setForm((f) => ({ ...f, birthday: e.target.value }))}
            />
          </div>

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

          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <UserPlus size={14} />
                Join the Lobsters 🦞
              </>
            )}
          </button>
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
    <div role="alert" className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="text-2xl">🦞</span>
        <div>
          <p className="font-semibold text-amber-800 text-sm">
            {needsInvite
              ? 'Your profile is waiting for an invite'
              : 'This name already has a profile'}
          </p>
          <p className="text-xs text-amber-700 mt-1">
            {needsInvite
              ? PLACEHOLDER_INVITE_TEXT
              : `If you’re ${match.name}, go back and sign in with your PIN or “Email me a sign-in link”.`}
          </p>
        </div>
      </div>
      {onSignIn && (
        <button
          type="button"
          onClick={onSignIn}
          className="w-full py-2.5 bg-amber-500 text-white rounded-xl font-semibold text-sm active:scale-95 transition-all"
        >
          {needsInvite ? 'Back to sign in' : 'Go to sign in'}
        </button>
      )}
      {!needsInvite && (
        <button
          type="button"
          onClick={onDecline}
          className="w-full py-2 text-amber-600 text-xs font-medium"
        >
          No, I’m a different person
        </button>
      )}
    </div>
  )
}
