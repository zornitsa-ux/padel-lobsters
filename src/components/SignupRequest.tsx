import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/useApp'
import { usePlayers, usePlayerActions, useAvatarUpload } from '../features/players/usePlayers'
import { randomAvatarFilename, setOwnAvatar } from '../features/players/playerQueries'
import { playerKeys } from '../features/players/playerKeys'
import { useQueryClient } from '@tanstack/react-query'
import { parseLevel } from '../lib/parseLevel'
import type { Player } from '../lib/normalise'
import type { PlayerInput } from '../features/players/playerQueries'
import { isE164 } from '../lib/whatsapp'
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
//    2. If a player with the same full name already exists in the roster
//       we show a merge banner and pre-fill the form from that record —
//       the user finishes their profile on top of the existing row
//       (keeps their PIN, their history, their aliases).
//    3. Optional avatar upload goes to the `avatars` Supabase Storage
//       bucket, same as the old in-app form.
//    4. Submit calls selfSignup (new) or updatePlayer (merge). On success
//       we surface the assigned PIN on a one-shot screen with a copy
//       button and auto-login with the PIN so the user lands already
//       signed in.
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
const ALREADY_A_LOBSTER =
  'A Lobster with this name already has a profile. If that’s you, sign in with your PIN or use “Forgot my PIN”.'

function signupErrorText(message: string): string {
  if (message.includes('rate limited'))
    return "We've seen too many signups from this device today. Please try again tomorrow or ask an admin to add you."
  if (message.includes('placeholder not claimable'))
    return 'We couldn’t link this to your existing profile. Please ask an admin to finish it for you.'
  return message || 'Could not create your profile — please try again.'
}

const randomPrompt = () => LOBBY_PROMPTS[Math.floor(Math.random() * LOBBY_PROMPTS.length)]

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

// `selfSignup` is typed `Promise<unknown>` by AppContext because it wraps the
// untyped auth API. Read the three fields this form branches on off it rather
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
  const { selfSignup, loginWithPin, session, role } = useApp()
  const { updatePlayer } = usePlayerActions({ session, role })
  const { data: players = [] } = usePlayers()
  const avatarUpload = useAvatarUpload()
  const qc = useQueryClient()
  const isAdmin = role === 'admin'

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

  // Merge state — when a new joiner's typed name matches an existing player,
  // we show a banner offering to complete that existing profile instead of
  // creating a duplicate row. `mergePlayer` holds the candidate; `editId`
  // flips the submit path from selfSignup → updatePlayer.
  const [mergePlayer, setMergePlayer] = useState<Player | null>(null)
  const [editId, setEditId] = useState<string | null>(null)

  // Avatar upload state — file is the pending upload (flushed to storage
  // on submit), preview is the dataURL so the user sees their pick
  // immediately.
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarWarning, setAvatarWarning] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Post-submit screen — { pin, wasExisting }. When set we show the PIN
  // reveal instead of the form.
  const [pinReveal, setPinReveal] = useState<{ pin: string; wasExisting: boolean } | null>(null)
  const [copied, setCopied] = useState(false)
  // Tracks the "Continue to the app" retry state on the success screen.
  // Separate from the form's `saving` so a retry can't re-trigger form
  // submission logic.
  const [continuing, setContinuing] = useState(false)
  const [continueError, setContinueError] = useState('')

  // Debounced duplicate check — fires ~400ms after the user stops typing
  // the full name. Same predicate Players.jsx uses so the behaviour is
  // consistent across surfaces.
  const mergeDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    if (editId) return
    clearTimeout(mergeDebounceRef.current)
    mergeDebounceRef.current = setTimeout(() => {
      const combined = `${(form.firstName || '').trim()} ${(form.lastName || '').trim()}`
        .trim()
        .toLowerCase()
      if (combined.split(/\s+/).length < 2) {
        setMergePlayer(null)
        return
      }
      const found = (players || []).find((p) => (p.name || '').trim().toLowerCase() === combined)
      setMergePlayer(found || null)
    }, 400)
    return () => clearTimeout(mergeDebounceRef.current)
  }, [form.firstName, form.lastName, editId, players])

  // Accept merge — pre-fill the form from the existing player so the user
  // lands on "their" profile and just fills in the fields they haven't
  // populated yet. Their PIN is preserved; submit switches to updatePlayer.
  const acceptMerge = () => {
    const p = mergePlayer
    if (!p || !canMerge(p)) return
    const nameParts = (p.name || '').trim().split(/\s+/)
    setForm({
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' '),
      email: p.email || '',
      phone: p.phone || '',
      playtomicLevel: p.playtomicLevel != null ? String(p.playtomicLevel) : '',
      notes: p.notes || '',
      gender: p.gender || '',
      isLeftHanded: p.isLeftHanded || false,
      country: p.country || '',
      avatarUrl: p.avatarUrl || '',
      birthday: p.birthday || '',
      preferredPosition: p.preferredPosition || '',
    })
    setAvatarPreview(p.avatarUrl || null)
    setEditId(p.id)
    setMergePlayer(null)
  }

  // Admins can merge onto any row. Everyone else is anonymous at this point
  // and may only claim an unclaimed placeholder (server-side, in
  // self_signup_player); an active profile needs its PIN.
  const canMerge = (p: Player) => isAdmin || p.status === 'placeholder'

  // Runs after the PIN is shown. Signing in first is what lets a brand-new
  // player write their own avatar (storage RLS: player-<auth.uid()>.webp).
  // May outlive this component: the gate unmounts it once the role flips.
  const finishSignup = async ({ pin, playerId }: { pin: string; playerId: string }) => {
    const login = await loginWithPin(pin)
    if (!login?.success || !avatarFile) return
    try {
      const processed = await processAvatar(avatarFile)
      await setOwnAvatar({ playerId, file: processed })
      await qc.invalidateQueries({ queryKey: playerKeys.all() })
    } catch (err) {
      console.error('Avatar upload after signup failed:', err)
      setAvatarWarning(true)
    }
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

  // Admin completing someone else's existing row. Admin may write any
  // avatar filename, so the photo goes up before the profile update.
  const adminCompleteProfile = async ({ id, data }: { id: string; data: PlayerInput }) => {
    let avatarUrl = data.avatarUrl || ''
    if (avatarFile) {
      try {
        const processed = await processAvatar(avatarFile)
        avatarUrl = await avatarUpload.mutateAsync({
          file: processed,
          filename: randomAvatarFilename(),
        })
      } catch (err) {
        console.error('Avatar upload error:', err)
      }
    }
    await updatePlayer(id, { ...data, avatarUrl })
    const pin = (players || []).find((p) => String(p.id) === String(id))?.pin || ''
    if (!pin) {
      setError(
        "We found your existing profile but couldn't read your PIN. Ask an admin to resend it.",
      )
      return
    }
    setPinReveal({ pin, wasExisting: true })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setError('')

    const firstName = (form.firstName || '').trim()
    const lastName = (form.lastName || '').trim()
    const combinedName = [firstName, lastName].filter(Boolean).join(' ')

    // Safety net — if an exact duplicate exists but the user hasn't merged,
    // force the merge banner rather than allowing a dupe row.
    if (!editId) {
      const typed = combinedName.toLowerCase()
      const duplicate = (players || []).find((p) => (p.name || '').trim().toLowerCase() === typed)
      if (duplicate) {
        setMergePlayer(duplicate)
        if (!canMerge(duplicate)) setError(ALREADY_A_LOBSTER)
        return
      }
    }

    // Required-field validation — matches Players.jsx's non-admin branch so
    // guest signups and in-app signups land the same shape in the DB.
    const missing = []
    if (!firstName) missing.push('First Name')
    if (!lastName) missing.push('Last Name')
    if (!form.country) missing.push('Country')
    if (!form.gender) missing.push('Gender')
    if (!form.email.trim()) missing.push('Email')
    if (!form.phone.trim()) missing.push('Phone / WhatsApp')
    if (!form.playtomicLevel) missing.push('Playtomic Level')
    if (missing.length > 0) {
      setError(`Please complete: ${missing.join(', ')}`)
      return
    }
    // Phone must be in international format (E.164) so we can build
    // wa.me links for transfer offers — e.g. "+31612345678".
    if (!isE164(form.phone)) {
      setError('Phone must start with + and the country code (e.g. +31612345678).')
      return
    }

    setSaving(true)
    try {
      const data = {
        name: combinedName,
        email: form.email.trim(),
        phone: form.phone.trim(),
        playtomicLevel: parseLevel(form.playtomicLevel),
        notes: form.notes || '',
        gender: form.gender || '',
        isLeftHanded: form.isLeftHanded || false,
        country: form.country || '',
        avatarUrl: form.avatarUrl || '',
        birthday: form.birthday || null,
        preferredPosition: form.preferredPosition || '',
        taglineLabel: lobbyPrompt.label,
        status: 'active',
      }

      if (editId && isAdmin) {
        await adminCompleteProfile({ id: editId, data })
        return
      }

      // Self-serve: route through selfSignup (anon-callable RPC), NOT
      // addPlayer — addPlayer requires the admin PIN. With editId set this
      // claims the placeholder row instead of inserting a new one.
      const signup = readSignupResult(await selfSignup({ ...data, claimPlaceholderId: editId }))
      if (signup.failed) {
        setError(signupErrorText(signup.errorMessage))
        return
      }
      if (signup.wasExisting) {
        // The RPC deliberately does NOT return the PIN to a stranger
        // holding the email — route the user to Forgot-my-PIN instead.
        setError(
          'An account with this email already exists. Use “Forgot my PIN” on the sign-in screen to recover it.',
        )
        return
      }
      if (!signup.pin || !signup.playerId) {
        setError(
          "Your profile was created but we couldn't read the PIN back. Please ask an admin to resend it.",
        )
        return
      }
      setPinReveal({ pin: signup.pin, wasExisting: false })
      finishSignup({ pin: signup.pin, playerId: signup.playerId }).catch(() => {})
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

  // "Continue to the app" on the success screen. Originally a no-op
  // that trusted the background auto-login fired from handleSubmit to
  // flip the role and unmount the gate. When verify_player_pin times
  // out (see v27 migration) the auto-login quietly fails, the role
  // stays 'guest', and Continue does nothing from the user's POV.
  // This handler retries the login explicitly and surfaces the result —
  // success dismisses the gate via onComplete + role change, failure
  // shows an inline error so the user understands what's happening
  // instead of being stuck.
  const continueToApp = async () => {
    if (continuing) return
    const pin = pinReveal?.pin || ''
    if (!pin) {
      // No PIN to retry with — fall back to the parent callback and
      // hope the role already flipped.
      onComplete?.('player')
      return
    }
    setContinuing(true)
    setContinueError('')
    try {
      const result = await loginWithPin(pin)
      if (result?.success) {
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

  // ── Success state — one-shot PIN reveal + auto-login ──────────────────────
  if (pinReveal) {
    return (
      <div className={`space-y-4 ${compact ? '' : 'max-w-md mx-auto p-4'}`}>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center mx-auto">
              <Check className="text-lob-teal" size={24} />
            </div>
            <h1 className="text-lg font-extrabold text-lob-dark">
              {pinReveal.wasExisting ? 'Welcome back 🦞' : "You're in 🦞"}
            </h1>
            <p className="text-sm text-lob-slate leading-snug">
              {pinReveal.wasExisting
                ? 'We found your existing Lobster profile and pulled up your PIN.'
                : "Your Lobster profile is ready. Save your PIN — you'll need it next time."}
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

          {avatarWarning && (
            <p className="text-xs text-amber-800 bg-amber-50 rounded-lg p-2">
              Your profile is saved, but the photo didn’t upload. You can add it from your profile.
            </p>
          )}

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

          {/* Merge banner — same visual as the in-app form so veterans who've
              played before recognise the "complete your profile" flow. */}
          {mergePlayer && !editId && !canMerge(mergePlayer) && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
              {ALREADY_A_LOBSTER}
            </p>
          )}
          {mergePlayer && !editId && canMerge(mergePlayer) && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🦞</span>
                <div>
                  <p className="font-semibold text-amber-800 text-sm">Welcome back!</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Your profile already exists — you've played in a past Lobster tournament. Finish
                    setting up your profile and we'll link everything together.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={acceptMerge}
                className="w-full py-2.5 bg-amber-500 text-white rounded-xl font-semibold text-sm active:scale-95 transition-all"
              >
                Yes, complete my profile
              </button>
              <button
                type="button"
                onClick={() => setMergePlayer(null)}
                className="w-full py-2 text-amber-600 text-xs font-medium"
              >
                No, I'm a different person
              </button>
            </div>
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
                type="number"
                step="0.1"
                min="0"
                max="7"
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
                {editId ? 'Complete my profile' : 'Join the Lobsters 🦞'}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
