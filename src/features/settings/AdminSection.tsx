import React, { type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { MessageCircle, Save, Info, Lightbulb, Plus, Trash2, RotateCcw } from 'lucide-react'
import SecurityEventsPanel from '../../components/SecurityEventsPanel'
import type { EditingTip, SettingsForm } from './settingsHelpers'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'
import { TextButton } from '../../components/ui/TextButton'
import { ListCard, ListRow } from '../../components/ui/ListCard'
import { Section } from '../../components/ui/Section'

interface AdminSectionProps {
  form: SettingsForm
  setForm: Dispatch<SetStateAction<SettingsForm>>
  saving: boolean
  saved: boolean
  handleSave: (e: FormEvent) => void
  // Tips
  activeTips: string[]
  isCustom: boolean
  tipsExpanded: boolean
  setTipsExpanded: Dispatch<SetStateAction<boolean>>
  newTip: string
  setNewTip: (tip: string) => void
  editingTip: EditingTip | null
  setEditingTip: Dispatch<SetStateAction<EditingTip | null>>
  handleAddTip: () => void
  handleDeleteTip: (index: number) => void
  handleEditTip: (index: number) => void
  handleSaveEdit: () => void
  handleResetTips: () => void
}

export default function AdminSection({
  form,
  setForm,
  saving,
  saved,
  handleSave,
  // Tips
  activeTips,
  isCustom,
  tipsExpanded,
  setTipsExpanded,
  newTip,
  setNewTip,
  editingTip,
  setEditingTip,
  handleAddTip,
  handleDeleteTip,
  handleEditTip,
  handleSaveEdit,
  handleResetTips,
}: AdminSectionProps) {
  return (
    <form onSubmit={handleSave} className="space-y-5">
      <Section title="Group Info" icon={<Info />}>
        <div>
          <label className="label">Group Name</label>
          <input
            className="input"
            placeholder="Padel Lobsters"
            value={form.groupName}
            onChange={(e) => setForm((f) => ({ ...f, groupName: e.target.value }))}
          />
        </div>
      </Section>

      <Section title="WhatsApp Community" icon={<MessageCircle />}>
        <div>
          <label className="label">Invite Link</label>
          <input
            className="input"
            type="url"
            placeholder="https://chat.whatsapp.com/xxxxxxxxxx"
            value={form.whatsappLink}
            onChange={(e) => setForm((f) => ({ ...f, whatsappLink: e.target.value }))}
          />
          <p className="text-xs text-lob-muted-light mt-1.5">
            Opens in WhatsApp when tapped in the header. Find it in your WhatsApp group → Invite via
            link.
          </p>
        </div>
        {form.whatsappLink && (
          <Button variant="secondary" href={form.whatsappLink} external icon={<MessageCircle />}>
            Open WhatsApp Community
          </Button>
        )}
      </Section>

      {/* Recent security events. Only visible when isAdmin is true and
          only mounts its internal RPC once expanded — no admin-only
          network traffic for non-admin users. */}
      <SecurityEventsPanel />

      <Section
        title="Padel Tips"
        icon={<Lightbulb />}
        description={`One tip shows per day on the home page. ${
          isCustom ? 'Using custom tips.' : `Using ${activeTips.length} default tips.`
        } Changes save automatically.`}
        action={
          <div className="flex items-center gap-2">
            {isCustom && (
              <TextButton tone="neutral" icon={<RotateCcw size={10} />} onClick={handleResetTips}>
                Reset to defaults
              </TextButton>
            )}
            <TextButton aria-expanded={tipsExpanded} onClick={() => setTipsExpanded((e) => !e)}>
              {tipsExpanded ? 'Collapse' : `View all (${activeTips.length})`}
            </TextButton>
          </div>
        }
      >
        {/* Add new tip */}
        <div className="flex gap-2">
          <input
            className="input flex-1 text-xs"
            placeholder="Add a new tip..."
            value={newTip}
            onChange={(e) => setNewTip(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTip())}
          />
          <Button icon={<Plus />} onClick={handleAddTip}>
            Add
          </Button>
        </div>

        {/* Tips list */}
        {tipsExpanded && (
          <ListCard label="Padel tips" scrollable>
            {activeTips.map((tip, i) => (
              <ListRow key={i}>
                <div className="flex items-start gap-2">
                  <span className="text-2xs text-lob-muted-light font-mono mt-0.5 flex-shrink-0 w-5">
                    {i + 1}
                  </span>
                  {editingTip?.index === i ? (
                    <div className="flex-1 flex gap-1">
                      <input
                        className="input flex-1 text-xs py-1"
                        value={editingTip.text}
                        onChange={(e) =>
                          setEditingTip((prev) => (prev ? { ...prev, text: e.target.value } : prev))
                        }
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                        autoFocus
                      />
                      <TextButton onClick={handleSaveEdit}>Save</TextButton>
                      <TextButton tone="neutral" onClick={() => setEditingTip(null)}>
                        Cancel
                      </TextButton>
                    </div>
                  ) : (
                    <>
                      <p
                        className="flex-1 text-xs text-lob-slate leading-relaxed cursor-pointer"
                        onClick={() => handleEditTip(i)}
                      >
                        {tip}
                      </p>
                      <IconButton
                        onClick={() => handleDeleteTip(i)}
                        aria-label="Delete tip"
                        variant="ghost-destructive"
                        size="sm"
                      >
                        <Trash2 />
                      </IconButton>
                    </>
                  )}
                </div>
              </ListRow>
            ))}
          </ListCard>
        )}
      </Section>

      {/* Save button */}
      <Button type="submit" disabled={saving} fullWidth icon={<Save />}>
        {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Settings'}
      </Button>
    </form>
  )
}
