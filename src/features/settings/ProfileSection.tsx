import React, {
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react'
import { Save, User, ChevronDown, ChevronUp, Camera, Mail, Check } from 'lucide-react'
import CountryPicker from '../../components/ui/CountryPicker'
import Avatar from '../../components/ui/Avatar'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { useApp } from '../../context/useApp'
import { LOBBY_PROMPTS, type ProfileForm } from './settingsHelpers'
import type { Player } from '../../lib/normalise'

interface ProfileSectionProps {
  myPlayer: Player | null
  hasPii: boolean
  profileLoadFailed?: boolean
  profileExpanded: boolean
  setProfileExpanded: Dispatch<SetStateAction<boolean>>
  profileForm: ProfileForm
  setProfileForm: (updater: (form: ProfileForm) => ProfileForm) => void
  profileSaving: boolean
  profileSaved: boolean
  profileError: string
  avatarPreview: string | null
  handleAvatarChange: (e: ChangeEvent<HTMLInputElement>) => void
  handleProfileSave: () => void
  activePrompt: number
  setActivePrompt: (index: number) => void
  showPlaytomicPrompt: boolean
  dismissPlaytomicPrompt: () => void
}

export default function ProfileSection({
  myPlayer,
  hasPii,
  profileLoadFailed = false,
  profileExpanded,
  setProfileExpanded,
  profileForm,
  setProfileForm,
  profileSaving,
  profileSaved,
  profileError,
  avatarPreview,
  handleAvatarChange,
  handleProfileSave,
  activePrompt,
  setActivePrompt,
  showPlaytomicPrompt,
  dismissPlaytomicPrompt,
}: ProfileSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Self-service email change. We keep state local to this section because
  // the flow is self-contained: type new email -> requestMyEmailChange ->
  // Supabase emails a confirmation link to the new (and old, since
  // double_confirm_changes=true) address -> on click, auth.users.email
  // updates -> the sync_auth_email_to_player trigger mirrors it back to
  // players.email. We never write players.email directly from the client.
  const { requestMyEmailChange } = useApp()
  const [emailEditing, setEmailEditing] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailStatus, setEmailStatus] = useState('') // '' | 'sent' | error string
  const submitEmailChange = async (e: FormEvent) => {
    e?.preventDefault?.()
    if (emailBusy) return
    setEmailBusy(true)
    setEmailStatus('')
    const result = await requestMyEmailChange(newEmail)
    setEmailBusy(false)
    if (result === 'sent') {
      setEmailStatus('sent')
      return
    }
    if (result === 'invalid')
      return setEmailStatus('That email looks off — double-check the format.')
    if (result === 'taken')
      return setEmailStatus('That email is already on another Lobster account.')
    setEmailStatus('Something went wrong. Try again in a moment.')
  }

  return (
    <>
      {/* ── Playtomic update popup ─────────────────────────────── */}
      {showPlaytomicPrompt && myPlayer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-xl">
            <div className="text-center">
              <div className="text-4xl mb-2">🦞</div>
              <h3 className="text-lg font-bold text-lob-dark">Has your Playtomic score changed?</h3>
              <p className="text-sm text-lob-muted mt-1">
                It's been a while! Your current level on file:
              </p>
            </div>
            <div className="bg-lob-cream rounded-2xl p-4 text-center">
              <p className="text-3xl font-bold text-lob-teal">
                {(parseFloat(String(myPlayer.playtomicLevel)) || 0).toFixed(1)}
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold text-lob-slate mb-1 block">
                New Playtomic Level
              </label>
              <input
                className="input text-center text-lg font-bold"
                type="number"
                step="0.01"
                min="0"
                max="10"
                value={profileForm.playtomicLevel}
                onChange={(e) => setProfileForm((f) => ({ ...f, playtomicLevel: e.target.value }))}
              />
            </div>
            {profileError && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{profileError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={dismissPlaytomicPrompt}
                className="flex-1 text-sm font-semibold text-lob-muted py-2.5 rounded-xl border border-gray-200 active:scale-95 transition-all"
              >
                No change
              </button>
              <button
                type="button"
                onClick={handleProfileSave}
                disabled={profileSaving}
                className="flex-1 bg-lob-teal text-white text-sm font-bold py-2.5 rounded-xl active:scale-95 transition-all disabled:opacity-50"
              >
                {profileSaving ? 'Saving…' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── My Lobster Profile (for claimed players) ──────────── */}
      {myPlayer && (
        <div className="card space-y-3">
          <button
            type="button"
            onClick={() => setProfileExpanded((e) => !e)}
            className="w-full flex items-center justify-between"
          >
            <h3 className="font-bold text-lob-slate text-sm flex items-center gap-2">
              <User size={15} className="text-lob-coral" /> My Lobster Profile
            </h3>
            {profileExpanded ? (
              <ChevronUp size={16} className="text-lob-muted-light" />
            ) : (
              <ChevronDown size={16} className="text-lob-muted-light" />
            )}
          </button>

          {/* Always-visible summary */}
          <div className="flex items-center gap-3">
            <Avatar player={myPlayer} size="lg" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-lob-dark truncate">{myPlayer.name}</p>
              <p className="text-xs text-lob-muted">
                Playtomic level:{' '}
                <span className="font-bold text-lob-teal">
                  {(parseFloat(String(myPlayer.playtomicLevel)) || 0).toFixed(1)}
                </span>
              </p>
            </div>
          </div>

          {/* Expanded full edit form */}
          {profileExpanded && (
            <div className="space-y-4 pt-2 border-t border-gray-100">
              {/* Avatar upload */}
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
                <p className="text-xs text-lob-muted-light">Tap camera icon to change photo</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>

              {/* Full Name */}
              <div>
                <label className="label">Full Name</label>
                <input
                  className="input"
                  placeholder="e.g. Augustin Tapia"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              {/* War Cry — toggleable prompt categories */}
              <div>
                <label className="label">War Cry</label>
                <SegmentedControl
                  ariaLabel="War cry prompt"
                  layout="wrap"
                  size="sm"
                  shape="pill"
                  className="mb-2"
                  options={LOBBY_PROMPTS.map((p, i) => ({ value: i, label: p.label }))}
                  value={activePrompt}
                  onChange={setActivePrompt}
                />
                <input
                  className="input"
                  type="text"
                  maxLength={80}
                  placeholder={LOBBY_PROMPTS[activePrompt].placeholder}
                  value={profileForm.tagline}
                  onChange={(e) => setProfileForm((f) => ({ ...f, tagline: e.target.value }))}
                />
                <p className="text-xs text-lob-muted-light mt-1">
                  Appears on your player card. {80 - profileForm.tagline.length} chars left.
                </p>
              </div>

              {/* Country */}
              <div>
                <label className="label">Country</label>
                <CountryPicker
                  value={profileForm.country}
                  onChange={(val: string) => setProfileForm((f) => ({ ...f, country: val }))}
                />
              </div>

              {/* Gender */}
              <div>
                <label className="label">Gender</label>
                <p className="text-xs text-lob-muted-light mb-2">For optimal pair matching</p>
                <div className="flex gap-3">
                  {[
                    ['male', 'Male'],
                    ['female', 'Female'],
                  ].map(([val, lbl]) => (
                    <button
                      type="button"
                      key={val}
                      onClick={() =>
                        setProfileForm((f) => ({ ...f, gender: f.gender === val ? '' : val }))
                      }
                      className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                        profileForm.gender === val
                          ? 'bg-lob-teal text-white'
                          : 'bg-gray-100 text-lob-slate'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Left-handed */}
              <div>
                <label className="label">Playing Hand</label>
                <button
                  type="button"
                  onClick={() => setProfileForm((f) => ({ ...f, isLeftHanded: !f.isLeftHanded }))}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all w-full justify-center ${
                    profileForm.isLeftHanded
                      ? 'bg-amber-100 text-amber-700 border-2 border-amber-300'
                      : 'bg-gray-100 text-lob-muted'
                  }`}
                >
                  🤚 {profileForm.isLeftHanded ? 'Left-handed (tap to undo)' : 'Tap if left-handed'}
                </button>
              </div>

              {/* Preferred side */}
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
                        setProfileForm((f) => ({
                          ...f,
                          preferredPosition: f.preferredPosition === val ? '' : val,
                        }))
                      }
                      className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-all ${
                        profileForm.preferredPosition === val
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-lob-slate'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Playtomic level */}
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
                    value={profileForm.playtomicLevel}
                    onChange={(e) =>
                      setProfileForm((f) => ({ ...f, playtomicLevel: e.target.value }))
                    }
                  />
                  <p className="text-xs text-lob-muted mt-1">
                    Check your Playtomic app — it shows your current level. Update it whenever it
                    changes: your matches are built from it.
                  </p>
                </div>
              </div>

              {/* Email — confirmation-gated. Self-service writes never
                  touch players.email directly; we route through
                  supabase.auth.updateUser so the new address is verified
                  before it becomes the account's source of truth. */}
              <div>
                <label className="label">Email</label>
                {!emailEditing && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm text-lob-slate truncate">
                      {profileForm.email || (
                        <span className="text-lob-muted-light">No email on file</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEmailEditing(true)
                        setNewEmail('')
                        setEmailStatus('')
                      }}
                      className="text-xs font-semibold text-lob-teal bg-lob-cream border border-lob-teal/30 px-3 py-2 rounded-xl active:scale-95"
                    >
                      Change
                    </button>
                  </div>
                )}
                {emailEditing && emailStatus !== 'sent' && (
                  <form onSubmit={submitEmailChange} className="space-y-2">
                    <input
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      className="input"
                      placeholder="you@example.com"
                      value={newEmail}
                      onChange={(e) => {
                        setNewEmail(e.target.value)
                        setEmailStatus('')
                      }}
                      autoFocus
                    />
                    {emailStatus && emailStatus !== 'sent' && (
                      <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{emailStatus}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEmailEditing(false)
                          setEmailStatus('')
                        }}
                        className="flex-1 text-sm font-semibold text-lob-slate bg-gray-100 py-2 rounded-xl active:scale-95"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={emailBusy || !newEmail.trim()}
                        className="flex-1 btn-primary flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <Mail size={13} />
                        {emailBusy ? 'Sending…' : 'Send confirmation'}
                      </button>
                    </div>
                    <p className="text-xs text-lob-muted">
                      We'll email a confirmation link to the new address. The change only takes
                      effect once you click it.
                    </p>
                  </form>
                )}
                {emailEditing && emailStatus === 'sent' && (
                  <div className="space-y-2">
                    <div className="rounded-xl bg-lob-cream border border-lob-teal/30 p-3 flex items-start gap-2">
                      <Check size={14} className="text-lob-teal mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-lob-slate leading-snug">
                        Confirmation sent to{' '}
                        <span className="font-semibold break-all">{newEmail.trim()}</span>. Click
                        the link in that email to finish the change.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEmailEditing(false)
                        setEmailStatus('')
                      }}
                      className="w-full text-sm font-semibold text-lob-teal py-2 rounded-xl bg-white border border-lob-teal/30"
                    >
                      Done
                    </button>
                  </div>
                )}
                <p className="text-xs text-lob-muted-light mt-1">Visible for organizers only</p>
              </div>

              {/* Phone */}
              <div>
                <label className="label">Phone / WhatsApp</label>
                <input
                  type="tel"
                  className="input"
                  placeholder="+31612345678"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
                />
                <p className="text-xs text-lob-muted-light mt-1">
                  Start with + and country code, e.g. +31 for the Netherlands. Visible to organizers
                  only.
                </p>
              </div>

              {/* Birthday */}
              <div>
                <label className="label">Birthday 🎂</label>
                <input
                  type="date"
                  className="input"
                  value={profileForm.birthday || ''}
                  onChange={(e) => setProfileForm((f) => ({ ...f, birthday: e.target.value }))}
                />
              </div>

              {/* Save button — disabled until the PII fetch has resolved, so
                  a save can never write blanks over real phone/birthday/email
                  while that overlay is still in flight or has failed. */}
              <button
                type="button"
                onClick={handleProfileSave}
                disabled={profileSaving || !hasPii}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <Save size={16} />
                {profileSaving
                  ? 'Saving…'
                  : profileLoadFailed
                    ? 'Profile unavailable'
                    : !hasPii
                      ? 'Loading your profile…'
                      : profileSaved
                        ? '✓ Saved!'
                        : 'Save Profile'}
              </button>
              {profileLoadFailed && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">
                  Couldn't load your profile details. Check your connection and reload.
                </p>
              )}
              {profileError && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{profileError}</p>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}
