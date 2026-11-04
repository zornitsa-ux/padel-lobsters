import React, { type ChangeEvent, type Dispatch, type SetStateAction } from 'react'
import { Save } from 'lucide-react'
import CountryPicker from '../../components/ui/CountryPicker'
import { AvatarPicker } from '../../components/ui/AvatarPicker'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { PlaytomicLevelField, ProfileChoiceFields } from '../players/ProfileFields'
import { LOBBY_PROMPTS, type ProfileForm } from './settingsHelpers'
import type { Player } from '../../lib/normalise'
import { ActionRow } from '../../components/ui/ActionRow'
import { Button } from '../../components/ui/Button'
import { AlertBox } from '../../components/ui/AlertBox'
import { Modal } from '../../components/ui/Modal'
import { FullScreenDialog } from '../../components/ui/FullScreenDialog'
import ProfileCard from './ProfileCard'

type SetProfileForm = (updater: (form: ProfileForm) => ProfileForm) => void

interface ProfileSectionProps {
  myPlayer: Player | null
  isAdmin: boolean
  hasPii: boolean
  profileLoadFailed?: boolean
  profileExpanded: boolean
  setProfileExpanded: Dispatch<SetStateAction<boolean>>
  profileForm: ProfileForm
  setProfileForm: SetProfileForm
  profileSaving: boolean
  profileError: string
  avatarPreview: string | null
  handleAvatarChange: (e: ChangeEvent<HTMLInputElement>) => void
  handleProfileSave: () => void
  activePrompt: number
  setActivePrompt: (index: number) => void
  showPlaytomicPrompt: boolean
  dismissPlaytomicPrompt: () => void
}

const formatLevel = (player: Player) => (parseFloat(String(player.playtomicLevel)) || 0).toFixed(1)

export default function ProfileSection({
  myPlayer,
  isAdmin,
  profileExpanded,
  setProfileExpanded,
  showPlaytomicPrompt,
  dismissPlaytomicPrompt,
  ...form
}: ProfileSectionProps) {
  if (!myPlayer) return null
  return (
    <>
      <ProfileCard player={myPlayer} isAdmin={isAdmin} onEdit={() => setProfileExpanded(true)} />
      <ProfileEditDialog
        open={profileExpanded}
        onClose={() => setProfileExpanded(false)}
        {...form}
      />
      <PlaytomicPrompt
        open={showPlaytomicPrompt && !profileExpanded}
        player={myPlayer}
        onDismiss={dismissPlaytomicPrompt}
        {...form}
      />
    </>
  )
}

type FormProps = Pick<
  ProfileSectionProps,
  | 'hasPii'
  | 'profileLoadFailed'
  | 'profileForm'
  | 'setProfileForm'
  | 'profileSaving'
  | 'profileError'
  | 'avatarPreview'
  | 'handleAvatarChange'
  | 'handleProfileSave'
  | 'activePrompt'
  | 'setActivePrompt'
>

function PlaytomicPrompt({
  open,
  player,
  onDismiss,
  profileForm,
  setProfileForm,
  profileSaving,
  profileError,
  handleProfileSave,
}: FormProps & { open: boolean; player: Player; onDismiss: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onDismiss}
      title="Has your Playtomic level changed?"
      description={`It's been a while. Your level on file is ${formatLevel(player)}.`}
      footer={
        <ActionRow>
          <Button variant="neutral" onClick={onDismiss}>
            No change
          </Button>
          <Button onClick={handleProfileSave} disabled={profileSaving}>
            {profileSaving ? 'Saving…' : 'Update'}
          </Button>
        </ActionRow>
      }
    >
      <div className="space-y-3">
        <PlaytomicLevelField
          value={profileForm.playtomicLevel}
          onChange={(value) => setProfileForm((f) => ({ ...f, playtomicLevel: value }))}
          hint="Your matches are built from it."
        />
        {profileError && (
          <AlertBox variant="error" size="sm">
            {profileError}
          </AlertBox>
        )}
      </div>
    </Modal>
  )
}

const saveLabel = ({
  profileSaving,
  profileLoadFailed,
  hasPii,
}: Pick<FormProps, 'profileSaving' | 'profileLoadFailed' | 'hasPii'>) => {
  if (profileSaving) return 'Saving…'
  if (profileLoadFailed) return 'Profile unavailable'
  if (!hasPii) return 'Loading your profile…'
  return 'Save Profile'
}

function ProfileEditDialog({
  open,
  onClose,
  ...props
}: FormProps & { open: boolean; onClose: () => void }) {
  const {
    hasPii,
    profileLoadFailed = false,
    profileSaving,
    profileError,
    handleProfileSave,
  } = props
  return (
    <FullScreenDialog
      open={open}
      onClose={onClose}
      title="Edit profile"
      footer={
        <div className="space-y-2">
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
          {/* Disabled until the PII read resolves, so a save never writes blanks over phone or birthday. */}
          <Button
            onClick={handleProfileSave}
            disabled={profileSaving || !hasPii}
            fullWidth
            icon={<Save />}
          >
            {saveLabel({ profileSaving, profileLoadFailed, hasPii })}
          </Button>
        </div>
      }
    >
      <ProfileFormFields {...props} />
    </FullScreenDialog>
  )
}

function ProfileFormFields({
  profileForm,
  setProfileForm,
  avatarPreview,
  handleAvatarChange,
  activePrompt,
  setActivePrompt,
}: FormProps) {
  return (
    <div className="space-y-4">
      <AvatarPicker preview={avatarPreview} onChange={handleAvatarChange} />

      <div>
        <label className="label">Full Name</label>
        <input
          className="input"
          placeholder="e.g. Augustin Tapia"
          value={profileForm.name}
          onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
        />
      </div>

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

      <h3 className="eyebrow pt-2">Private details · organizers only</h3>

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
          Start with + and the country code, e.g. +31 for the Netherlands.
        </p>
      </div>

      <div>
        <label className="label">Birthday</label>
        <input
          type="date"
          className="input"
          value={profileForm.birthday || ''}
          onChange={(e) => setProfileForm((f) => ({ ...f, birthday: e.target.value }))}
        />
      </div>

      <p className="text-xs text-lob-muted">
        Your email is your sign-in: change it under Sign-in &amp; security on the Account page.
      </p>
    </div>
  )
}
