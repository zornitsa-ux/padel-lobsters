import React from 'react'
import { User, Camera } from 'lucide-react'
import CountryPicker from '../../components/ui/CountryPicker'
import { Modal } from '../../components/ui/Modal'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import type { LobbyPrompt, PlayerFormState } from './playerConstants'
import type { CommunityPlayer } from './playersSelectors'

interface PlayerFormProps {
  showForm: boolean
  editId: string | null
  isAdmin: boolean
  form: PlayerFormState
  setForm: React.Dispatch<React.SetStateAction<PlayerFormState>>
  avatarPreview: string | null
  fileInputRef: React.RefObject<HTMLInputElement>
  handleAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  saving: boolean
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
  fileInputRef,
  handleAvatarChange,
  handleSubmit,
  saving,
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
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button type="submit" form="player-form" disabled={saving} className="btn-primary flex-1">
            {saving
              ? 'Saving...'
              : editId
                ? 'Save Changes'
                : isAdmin
                  ? 'Add Player'
                  : 'Join the Lobsters 🦞'}
          </button>
        </div>
      }
    >
      <form id="player-form" onSubmit={handleSubmit} className="space-y-4">
        {!editId && !isAdmin && (
          <p className="text-xs text-gray-500 -mt-2">You'll get an access PIN to use in the app</p>
        )}
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
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300">
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
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🦞</span>
              <div>
                {isAdmin ? (
                  <>
                    <p className="font-semibold text-amber-800 text-sm">Player already exists!</p>
                    <p className="text-xs text-amber-700 mt-1">
                      <strong>{mergePlayer.name}</strong> is already in the system. Update their
                      existing profile instead of creating a duplicate?
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-amber-800 text-sm">Welcome back!</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Your profile already exists — you've played in a past Lobster tournament.
                      Finish setting up your profile and we'll link everything together.
                    </p>
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={acceptMerge}
              className="w-full py-2.5 bg-amber-500 text-white rounded-xl font-semibold text-sm active:scale-95 transition-all"
            >
              {isAdmin
                ? `Update ${(mergePlayer.name || '').split(' ')[0]}'s profile`
                : 'Yes, complete my profile'}
            </button>
            <button
              type="button"
              onClick={() => setMergePlayer(null)}
              className="w-full py-2 text-amber-600 text-xs font-medium"
            >
              {isAdmin ? 'No, create as a new player' : "No, I'm a different person"}
            </button>
          </div>
        )}

        <div>
          <label className="label">Country</label>
          <CountryPicker
            value={form.country}
            onChange={(val: string) => setForm((f) => ({ ...f, country: val }))}
          />
        </div>

        {/* Gender — for optimal pair matching */}
        <div>
          <label className="label">Gender</label>
          <p className="text-xs text-gray-400 mb-2">For optimal pair matching</p>
          <SegmentedControl
            ariaLabel="Gender"
            options={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
            ]}
            value={form.gender}
            onChange={(val: string) =>
              setForm((f) => ({ ...f, gender: f.gender === val ? '' : val }))
            }
          />
        </div>

        {/* Left-handed */}
        <div>
          <label className="label">Playing hand</label>
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, isLeftHanded: !f.isLeftHanded }))}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all w-full justify-center ${
              form.isLeftHanded
                ? 'bg-amber-100 text-amber-700 border-2 border-amber-300'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            🤚 {form.isLeftHanded ? 'Left-handed (tap to undo)' : 'Tap if left-handed'}
          </button>
        </div>

        {/* Preferred position */}
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
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-blue-50 rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Playtomic Level</p>
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
            <p className="text-xs text-gray-500 mt-1">
              Check your Playtomic app — it shows your current level. Editing it re-anchors the
              player's learned level.
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
          <p className="text-xs text-gray-400 mt-1">Visible for organizers only</p>
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
          <p className="text-xs text-gray-400 mt-1">Visible for organizers only</p>
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
      </form>
    </Modal>
  )
}
