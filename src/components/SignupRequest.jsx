import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../supabase'
import {
  ArrowLeft, UserPlus, Check, Loader2, Copy, User, Camera,
} from 'lucide-react'
import CountryPicker from './CountryPicker'

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
//       hand, preferred side, Playtomic level, optional adjustment, email,
//       phone, birthday, rotating "lobby prompt" note).
//    2. If a player with the same full name already exists in the roster
//       we show a merge banner and pre-fill the form from that record —
//       the user finishes their profile on top of the existing row
//       (keeps their PIN, their history, their aliases).
//    3. Optional avatar upload goes to the `avatars` Supabase Storage
//       bucket, same as the old in-app form.
//    4. Submit calls addPlayer (new) or updatePlayer (merge). On success
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
  { label: '🎤 Trash Talk',         placeholder: 'Say something to your future opponents…' },
  { label: '🦞 Lobster Confession', placeholder: 'Confess your deepest padel sin…' },
  { label: '💬 War Cry',            placeholder: 'What do you scream before a match?' },
  { label: '🏅 Bold Claim',         placeholder: 'Make a promise you may not keep…' },
  { label: '🎯 Battle Cry',         placeholder: 'Inspire (or scare) your opponents…' },
  { label: '😤 Excuse Generator',   placeholder: 'Pre-write your excuse for losing today…' },
  { label: '🤝 Personal Pledge',    placeholder: 'What do you bring to the court?' },
  { label: '👀 Scouting Report',    placeholder: 'Describe your playing style in one line…' },
]
const randomPrompt = () => LOBBY_PROMPTS[Math.floor(Math.random() * LOBBY_PROMPTS.length)]

const emptyForm = {
  firstName: '', lastName: '',
  email: '', phone: '',
  playtomicLevel: '', adjustment: '0',
  notes: '', gender: '',
  isLeftHanded: false, country: '',
  avatarUrl: '', birthday: '',
  preferredPosition: '',
}

export default function SignupRequest({ onComplete, onBack, compact = false }) {
  const { players, addPlayer, updatePlayer, loginWithPin } = useApp()

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
  // flips the submit path from addPlayer → updatePlayer.
  const [mergePlayer, setMergePlayer] = useState(null)
  const [editId, setEditId] = useState(null)

  // Avatar upload state — file is the pending upload (flushed to storage
  // on submit), preview is the dataURL so the user sees their pick
  // immediately.
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const fileInputRef = useRef(null)

  // Post-submit screen — { pin, wasExisting }. When set we show the PIN
  // reveal instead of the form.
  const [pinReveal, setPinReveal] = useState(null)
  const [copied, setCopied] = useState(false)

  // Debounced duplicate check — fires ~400ms after the user stops typing
  // the full name. Same predicate Players.jsx uses so the behaviour is
  // consistent across surfaces.
  const mergeDebounceRef = useRef(null)
  useEffect(() => {
    if (editId) return
    clearTimeout(mergeDebounceRef.current)
    mergeDebounceRef.current = setTimeout(() => {
      const combined = `${(form.firstName || '').trim()} ${(form.lastName || '').trim()}`
        .trim().toLowerCase()
      if (combined.split(/\s+/).length < 2) { setMergePlayer(null); return }
      const found = (players || []).find(p =>
        (p.name || '').trim().toLowerCase() === combined
      )
      setMergePlayer(found || null)
    }, 400)
    return () => clearTimeout(mergeDebounceRef.current)
  }, [form.firstName, form.lastName, editId, players])

  // Accept merge — pre-fill the form from the existing player so the user
  // lands on "their" profile and just fills in the fields they haven't
  // populated yet. Their PIN is preserved; submit switches to updatePlayer.
  const acceptMerge = () => {
    const p = mergePlayer
    if (!p) return
    const nameParts = (p.name || '').trim().split(/\s+/)
    setForm({
      firstName: nameParts[0] || '',
      lastName:  nameParts.slice(1).join(' '),
      email:             p.email             || '',
      phone:             p.phone             || '',
      playtomicLevel:    p.playtomicLevel    ?? '',
      adjustment:        p.adjustment        ?? '0',
      notes:             p.notes             || '',
      gender:            p.gender            || '',
      isLeftHanded:      p.isLeftHanded      || false,
      country:           p.country           || '',
      avatarUrl:         p.avatarUrl         || '',
      birthday:          p.birthday          || '',
      preferredPosition: p.preferredPosition || '',
    })
    setAvatarPreview(p.avatarUrl || null)
    setEditId(p.id)
    setMergePlayer(null)
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    setError('')

    const firstName = (form.firstName || '').trim()
    const lastName  = (form.lastName  || '').trim()
    const combinedName = [firstName, lastName].filter(Boolean).join(' ')

    // Safety net — if an exact duplicate exists but the user hasn't merged,
    // force the merge banner rather than allowing a dupe row.
    if (!editId) {
      const typed = combinedName.toLowerCase()
      const duplicate = (players || []).find(p =>
        (p.name || '').trim().toLowerCase() === typed
      )
      if (duplicate) {
        setMergePlayer(duplicate)
        return
      }
    }

    // Required-field validation — matches Players.jsx's non-admin branch so
    // guest signups and in-app signups land the same shape in the DB.
    const missing = []
    if (!firstName)                   missing.push('First Name')
    if (!lastName)                    missing.push('Last Name')
    if (!form.country)                missing.push('Country')
    if (!form.gender)                 missing.push('Gender')
    if (!form.email.trim())           missing.push('Email')
    if (!form.phone.trim())           missing.push('Phone / WhatsApp')
    if (!form.playtomicLevel)         missing.push('Playtomic Level')
    if (missing.length > 0) {
      setError(`Please complete: ${missing.join(', ')}`)
      return
    }

    setSaving(true)
    try {
      // Avatar upload — same bucket and naming pattern the in-app form used.
      let avatarUrl = form.avatarUrl || ''
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop()
        const filename = `player-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('avatars').upload(filename, avatarFile, { upsert: true })
        if (uploadError) {
          console.error('Avatar upload error:', uploadError)
          // Non-fatal — signup still proceeds without the photo.
        } else {
          const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filename)
          avatarUrl = publicUrl
        }
      }

      const data = {
        name: combinedName,
        email:             form.email.trim(),
        phone:             form.phone.trim(),
        playtomicLevel:    parseFloat(form.playtomicLevel) || 0,
        adjustment:        parseFloat(form.adjustment) || 0,
        notes:             form.notes || '',
        gender:            form.gender || '',
        isLeftHanded:      form.isLeftHanded || false,
        country:           form.country || '',
        avatarUrl,
        birthday:          form.birthday || null,
        preferredPosition: form.preferredPosition || '',
        taglineLabel:      lobbyPrompt.label,
        status:            'active',
      }

      if (editId) {
        // Merge path — write onto the existing row. PIN stays untouched.
        await updatePlayer(editId, data)
        const existing = (players || []).find(p => String(p.id) === String(editId))
        const pin = existing?.pin || ''
        setPinReveal({ pin, wasExisting: true })
        if (pin) loginWithPin(pin).catch(() => {})
      } else {
        const newPlayer = await addPlayer(data)
        if (!newPlayer?.pin) {
          setError('Could not create your profile — please try again.')
          setSaving(false)
          return
        }
        setPinReveal({ pin: newPlayer.pin, wasExisting: false })
        loginWithPin(newPlayer.pin).catch(() => {})
      }
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
    } catch { /* secure context etc. — PIN is visible in the callout */ }
  }

  // ── Success state — one-shot PIN reveal + auto-login ──────────────────────
  if (pinReveal) {
    return (
      <div className={`space-y-4 ${compact ? '' : 'max-w-md mx-auto p-4'}`}>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center mx-auto">
              <Check className="text-lobster-teal" size={24} />
            </div>
            <h1 className="text-lg font-extrabold text-gray-800">
              {pinReveal.wasExisting ? 'Welcome back 🦞' : "You're in 🦞"}
            </h1>
            <p className="text-sm text-gray-600 leading-snug">
              {pinReveal.wasExisting
                ? 'We found your existing Lobster profile and pulled up your PIN.'
                : 'Your Lobster profile is ready. Save your PIN — you\'ll need it next time.'}
            </p>
          </div>

          <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-lobster-teal font-bold uppercase tracking-wide">Your PIN</div>
              <div className="text-2xl font-extrabold tracking-[0.4em] text-lobster-teal">{pinReveal.pin || '????'}</div>
            </div>
            <button
              onClick={copyPin}
              className="text-xs font-semibold text-lobster-teal hover:text-teal-700 flex items-center gap-1"
            >
              <Copy size={12} />
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <p className="text-[11px] text-gray-500 leading-snug">
            This PIN unlocks the app on any device. Save it in your password
            manager — we don't email or text it automatically.
          </p>

          <button
            onClick={() => onComplete?.('player')}
            className="w-full bg-lobster-teal text-white font-bold text-sm py-2.5 rounded-xl hover:bg-teal-700 transition"
          >
            Continue to the app →
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
          className="text-sm text-gray-600 hover:text-lobster-teal flex items-center gap-1"
          type="button"
        >
          <ArrowLeft size={14} /> Back to sign in
        </button>
      )}

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
        <header className="space-y-1">
          <h1 className="text-lg font-extrabold text-gray-800 flex items-center gap-2">
            <UserPlus size={18} className="text-lobster-teal" />
            Join the Lobsters 🦞
          </h1>
          <p className="text-xs text-gray-500 leading-snug">
            You'll get an access PIN to use in the app. Fill in the full
            profile — it powers matchmaking, your Lobster Review, and the
            leaderboards.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Avatar — optional, but the same slot the in-app form offered. */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Preview"
                  className="w-20 h-20 rounded-full object-cover border-2 border-lobster-teal" />
              ) : (
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300">
                  <User size={28} />
                </div>
              )}
              <button type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-7 h-7 bg-lobster-teal rounded-full flex items-center justify-center text-white shadow-sm active:scale-95">
                <Camera size={13} />
              </button>
            </div>
            <p className="text-xs text-gray-400">Tap camera icon to add photo</p>
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
              <input required className="input" placeholder="e.g. Augustin"
                value={form.firstName}
                onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div>
              <label className="label">Last Name</label>
              <input required className="input" placeholder="e.g. Tapia"
                value={form.lastName}
                onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
            </div>
          </div>

          {/* Merge banner — same visual as the in-app form so veterans who've
              played before recognise the "complete your profile" flow. */}
          {mergePlayer && !editId && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🦞</span>
                <div>
                  <p className="font-semibold text-amber-800 text-sm">Welcome back!</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Your profile already exists — you've played in a past
                    Lobster tournament. Finish setting up your profile and
                    we'll link everything together.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={acceptMerge}
                className="w-full py-2.5 bg-amber-500 text-white rounded-xl font-semibold text-sm active:scale-95 transition-all">
                Yes, complete my profile
              </button>
              <button
                type="button"
                onClick={() => setMergePlayer(null)}
                className="w-full py-2 text-amber-600 text-xs font-medium">
                No, I'm a different person
              </button>
            </div>
          )}

          <div>
            <label className="label">Country</label>
            <CountryPicker
              value={form.country}
              onChange={val => setForm(f => ({ ...f, country: val }))}
            />
          </div>

          <div>
            <label className="label">Gender</label>
            <p className="text-xs text-gray-400 mb-2">For optimal pair matching</p>
            <div className="flex gap-3">
              {[['male', 'Male'], ['female', 'Female']].map(([val, lbl]) => (
                <button type="button" key={val}
                  onClick={() => setForm(f => ({ ...f, gender: f.gender === val ? '' : val }))}
                  className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                    form.gender === val ? 'bg-lobster-teal text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Playing hand</label>
            <button type="button"
              onClick={() => setForm(f => ({ ...f, isLeftHanded: !f.isLeftHanded }))}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all w-full justify-center ${
                form.isLeftHanded
                  ? 'bg-amber-100 text-amber-700 border-2 border-amber-300'
                  : 'bg-gray-100 text-gray-500'
              }`}>
              🤚 {form.isLeftHanded ? 'Left-handed (tap to undo)' : 'Tap if left-handed'}
            </button>
          </div>

          <div>
            <label className="label">Preferred Side</label>
            <div className="flex gap-2">
              {[['left', '👈 Left'], ['right', '👉 Right'], ['both', '↔️ Both']].map(([val, lbl]) => (
                <button type="button" key={val}
                  onClick={() => setForm(f => ({ ...f, preferredPosition: f.preferredPosition === val ? '' : val }))}
                  className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-all ${
                    form.preferredPosition === val ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Playtomic Level</p>
            <div>
              <label className="label">Playtomic Level (0–7)</label>
              <input type="number" step="0.1" min="0" max="7" className="input" placeholder="e.g. 3.5"
                value={form.playtomicLevel}
                onChange={e => setForm(f => ({ ...f, playtomicLevel: e.target.value }))} />
              <p className="text-xs text-gray-500 mt-1">
                Check your Playtomic app — it shows your current level
              </p>
            </div>
            <div>
              <label className="label">Personal Adjustment</label>
              <input type="number" step="0.1" min="-3" max="3" className="input" placeholder="0"
                value={form.adjustment}
                onChange={e => setForm(f => ({ ...f, adjustment: e.target.value }))} />
              <p className="text-xs text-gray-500 mt-1">
                Positive = stronger · Negative = weaker<br />
                Adjusted Level = {((parseFloat(form.playtomicLevel) || 0) + (parseFloat(form.adjustment) || 0)).toFixed(1)}
              </p>
            </div>
          </div>

          <div>
            <label className="label">Email</label>
            <input type="email" className="input" placeholder="player@email.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <p className="text-xs text-gray-400 mt-1">Visible for organizers only</p>
          </div>

          <div>
            <label className="label">Phone / WhatsApp</label>
            <input type="tel" className="input" placeholder="+31 6 12345678"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            <p className="text-xs text-gray-400 mt-1">Visible for organizers only</p>
          </div>

          <div>
            <label className="label">Birthday 🎂</label>
            <input type="date" className="input" value={form.birthday || ''}
              onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))} />
          </div>

          <div>
            <label className="label">{lobbyPrompt.label}</label>
            <textarea className="input resize-none" rows={2}
              placeholder={lobbyPrompt.placeholder}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{error}</p>
          )}

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
