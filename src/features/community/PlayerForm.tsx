import React from 'react'
import { AvatarPicker } from '../../components/ui/AvatarPicker'
import CountryPicker from '../../components/ui/CountryPicker'
import { Modal } from '../../components/ui/Modal'
import { PlaytomicLevelField, ProfileChoiceFields } from '../players/ProfileFields'
import type { LobbyPrompt, PlayerFormState } from './playerConstants'
import type { CommunityPlayer } from './playersSelectors'
import { ActionRow } from '../../components/ui/ActionRow'
import { Button } from '../../components/ui/Button'
import { TextButton } from '../../components/ui/TextButton'
import { AlertBox } from '../../components/ui/AlertBox'
import { Spinner } from '../../components/ui/Spinner'

interface PlayerFormProps {
  showForm: boolean
  editId: string | null
  isAdmin: boolean
  form: PlayerFormState
  setForm: React.Dispatch<React.SetStateAction<PlayerFormState>>
  avatarPreview: string | null
  handleAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  saving: boolean
  /** False while the PII resolve for an edit/merge is still in flight. */
  formReady: boolean
  /** The level failed its check on save; shown under the field, as the modal hides page errors. */
  levelError: string
  /** Existing player matching the typed name; drives the merge banner. */
  mergePlayer: CommunityPlayer | null
  setMergePlayer: (player: CommunityPlayer | null) => void
  acceptMerge: () => void
  lobbyPrompt: LobbyPrompt
  onClose: () => void
}

export default function PlayerForm({
  showForm,
  editId,
  isAdmin,
  form,
  setForm,
  avatarPreview,
  handleAvatarChange,
  handleSubmit,
  saving,
  formReady,
  levelError,
  mergePlayer,
  setMergePlayer,
  acceptMerge,
  lobbyPrompt,
  onClose,
}: PlayerFormProps) {
  return (
    <Modal
      open={showForm}
      onClose={onClose}
      title={editId ? 'Edit Player' : 'Join the Lobsters 🦞'}
      dismissible={false}
      footer={
        <ActionRow>
          <Button onClick={onClose} disabled={saving} variant="secondary">
            Cancel
          </Button>
          <Button type="submit" form="player-form" disabled={saving || !formReady}>
            {saving
              ? 'Saving...'
              : !formReady
                ? 'Loading...'
                : editId
                  ? 'Save Changes'
                  : isAdmin
                    ? 'Add Player'
                    : 'Join the Lobsters 🦞'}
          </Button>
        </ActionRow>
      }
    >
      <form id="player-form" onSubmit={handleSubmit} className="space-y-4">
        {!editId && !isAdmin && (
          <p className="text-xs text-lob-muted -mt-2">You'll sign in with a code we email you</p>
        )}
        {editId && !formReady && <Spinner size="inline" label="Loading this player's details…" />}
        {/* Disabled while an edit/merge's PII resolve is in flight — the
            fields below may still be seeded from a previous player or be
            blank placeholders at that point, so editing them now would be
            edits against a value about to be replaced. */}
        <fieldset disabled={!formReady} className="space-y-4">
          <AvatarPicker preview={avatarPreview} onChange={handleAvatarChange} />

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

          {/* Merge banner — shown for both admins and players when name already exists */}
          {mergePlayer && !editId && (
            <AlertBox
              variant="warning"
              title={isAdmin ? 'Player already exists!' : 'Welcome back!'}
              actions={
                <div className="space-y-3">
                  <Button fullWidth onClick={acceptMerge}>
                    {isAdmin
                      ? `Update ${(mergePlayer.name || '').split(' ')[0]}'s profile`
                      : 'Yes, complete my profile'}
                  </Button>
                  <div className="text-center">
                    <TextButton tone="warning" onClick={() => setMergePlayer(null)}>
                      {isAdmin ? 'No, create as a new player' : "No, I'm a different person"}
                    </TextButton>
                  </div>
                </div>
              }
            >
              {isAdmin ? (
                <>
                  <strong>{mergePlayer.name}</strong> is already in the system. Update their
                  existing profile instead of creating a duplicate?
                </>
              ) : (
                <>
                  Your profile already exists — you've played in a past Lobster tournament. Finish
                  setting up your profile and we'll link everything together.
                </>
              )}
            </AlertBox>
          )}

          <div>
            <label className="label">Country</label>
            <CountryPicker
              value={form.country}
              onChange={(val: string) => setForm((f) => ({ ...f, country: val }))}
            />
          </div>

          <ProfileChoiceFields form={form} setForm={setForm} />

          <PlaytomicLevelField
            value={form.playtomicLevel}
            onChange={(value) => setForm((f) => ({ ...f, playtomicLevel: value }))}
            hint="Editing it re-anchors the player's learned level."
            error={levelError}
          />

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
              placeholder="+31 6 12345678"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <p className="text-xs text-lob-muted-light mt-1">Visible for organizers only</p>
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
        </fieldset>
      </form>
    </Modal>
  )
}
