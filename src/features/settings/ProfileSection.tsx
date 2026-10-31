import React, { type ChangeEvent, type Dispatch, type SetStateAction } from 'react'
import { Save, User } from 'lucide-react'
import CountryPicker from '../../components/ui/CountryPicker'
import Avatar from '../../components/ui/Avatar'
import { AvatarPicker } from '../../components/ui/AvatarPicker'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { PlaytomicLevelField, ProfileChoiceFields } from '../players/ProfileFields'
import { LOBBY_PROMPTS, type ProfileForm } from './settingsHelpers'
import type { Player } from '../../lib/normalise'
import { ActionRow } from '../../components/ui/ActionRow'
import { Button } from '../../components/ui/Button'
import { Section } from '../../components/ui/Section'
import { TextButton } from '../../components/ui/TextButton'
import { AlertBox } from '../../components/ui/AlertBox'

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
            <p className="text-3xl font-bold text-lob-teal text-center">
              {(parseFloat(String(myPlayer.playtomicLevel)) || 0).toFixed(1)}
            </p>
            <div>
              <label className="text-xs font-semibold text-lob-slate mb-1 block">
                New Playtomic Level
              </label>
              <input
                className="input text-center text-lg font-bold"
                type="text"
                inputMode="decimal"
                value={profileForm.playtomicLevel}
                onChange={(e) => setProfileForm((f) => ({ ...f, playtomicLevel: e.target.value }))}
              />
            </div>
            {profileError && (
              <AlertBox variant="error" size="sm">
                {profileError}
              </AlertBox>
            )}
            <ActionRow>
              <Button variant="neutral" onClick={dismissPlaytomicPrompt}>
                No change
              </Button>
              <Button onClick={handleProfileSave} disabled={profileSaving}>
                {profileSaving ? 'Saving…' : 'Update'}
              </Button>
            </ActionRow>
          </div>
        </div>
      )}

      {/* ── My Lobster Profile (for claimed players) ──────────── */}
      {myPlayer && (
        <Section
          title="My Lobster Profile"
          icon={<User />}
          action={
            <TextButton
              hitArea
              aria-expanded={profileExpanded}
              onClick={() => setProfileExpanded((e) => !e)}
            >
              {profileExpanded ? 'Close' : 'Edit'}
            </TextButton>
          }
        >
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
          {profileExpanded && (
            <div className="space-y-4">
              <AvatarPicker preview={avatarPreview} onChange={handleAvatarChange} />

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
                <div className="space-y-2">
                  <SegmentedControl
                    ariaLabel="War cry prompt"
                    layout="wrap"
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
                </div>
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

              <ProfileChoiceFields form={profileForm} setForm={setProfileForm} />

              <PlaytomicLevelField
                value={profileForm.playtomicLevel}
                onChange={(value) => setProfileForm((f) => ({ ...f, playtomicLevel: value }))}
                hint="Update it whenever it changes: your matches are built from it."
              />

              {/* Email is read-only here: changes go through the confirmed flow in Sign-in & security. */}
              <div>
                <label className="label">Email</label>
                <div className="px-3 py-2 rounded-xl bg-lob-well border border-lob-line-strong text-sm text-lob-slate truncate">
                  {profileForm.email || (
                    <span className="text-lob-muted-light">No email on file</span>
                  )}
                </div>
                <p className="text-xs text-lob-muted-light mt-1">
                  Change it under Sign-in &amp; security.
                </p>
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
              <Button
                onClick={handleProfileSave}
                disabled={profileSaving || !hasPii}
                fullWidth
                icon={<Save />}
              >
                {profileSaving
                  ? 'Saving…'
                  : profileLoadFailed
                    ? 'Profile unavailable'
                    : !hasPii
                      ? 'Loading your profile…'
                      : profileSaved
                        ? '✓ Saved!'
                        : 'Save Profile'}
              </Button>
              {profileLoadFailed && (
                <AlertBox variant="error" size="sm">
                  Couldn't load your profile details. Check your connection and reload.
                </AlertBox>
              )}
              {profileError && (
                <AlertBox variant="error" size="sm">
                  {profileError}
                </AlertBox>
              )}
            </div>
          )}
        </Section>
      )}
    </>
  )
}
