import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { useSettings, useSaveSettings } from './useSettings'
import { useTipsEditor } from './useTipsEditor'
import { errorMessage } from '../../lib/errors'
import DEFAULT_TIPS from '../../data/padelTips'
import type { EditingTip, SettingsForm } from './settingsHelpers'
import AdminSection from './AdminSection'
import { PageHeader } from '../../components/ui/PageHeader'

const formFromSettings = (
  settings?: { whatsappLink?: string | null; groupName?: string | null } | null,
): SettingsForm => ({
  whatsappLink: settings?.whatsappLink || '',
  groupName: settings?.groupName || 'Padel Lobsters',
})

/** Admin-only app config: group name, WhatsApp link, security log and daily tips. */
export default function GroupSettingsPage() {
  const { data: settings } = useSettings()
  const saveSettingsMutation = useSaveSettings()
  // Null until the admin types, so a refetch can't overwrite an edit in progress.
  const [draft, setDraft] = useState<SettingsForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newTip, setNewTip] = useState('')
  const [editingTip, setEditingTip] = useState<EditingTip | null>(null)
  const [tipsExpanded, setTipsExpanded] = useState(false)

  const form = draft ?? formFromSettings(settings)
  const setForm: Dispatch<SetStateAction<SettingsForm>> = (update) =>
    setDraft((current) => {
      const base = current ?? formFromSettings(settings)
      return typeof update === 'function' ? update(base) : update
    })

  const { tips, change: changeTips } = useTipsEditor({
    saved: settings?.padelTips,
    save: (padelTips) => saveSettingsMutation.mutateAsync({ padelTips }),
    onError: (err) => alert('Could not save tip change: ' + errorMessage(err, 'unknown error')),
  })
  const activeTips = tips || DEFAULT_TIPS
  const isCustom = tips !== null

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await saveSettingsMutation.mutateAsync(form)
      setDraft((current) => (current === form ? null : current))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      alert('Could not save settings: ' + errorMessage(err, 'unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const handleAddTip = () => {
    const tip = newTip.trim()
    if (!tip) return
    setNewTip('')
    changeTips((current) => [...current, tip])
  }

  const handleDeleteTip = (idx: number) => {
    changeTips((current) => {
      const remaining = current.filter((_, i) => i !== idx)
      return remaining.length > 0 ? remaining : null
    })
  }

  const handleEditTip = (idx: number) => {
    setEditingTip({ index: idx, text: activeTips[idx] })
  }

  const handleSaveEdit = () => {
    const text = editingTip?.text.trim()
    if (!editingTip || !text) return
    const { index } = editingTip
    setEditingTip(null)
    changeTips((current) => current.map((tip, i) => (i === index ? text : tip)))
  }

  const handleResetTips = () => changeTips(() => null)

  return (
    <div className="-mx-4">
      <PageHeader title="Group settings" backLink={{ to: '/admin', label: 'Admin' }} />
      <div className="px-4 pt-4 pb-6">
        <AdminSection
          form={form}
          setForm={setForm}
          saving={saving}
          saved={saved}
          handleSave={handleSave}
          activeTips={activeTips}
          isCustom={isCustom}
          tipsExpanded={tipsExpanded}
          setTipsExpanded={setTipsExpanded}
          newTip={newTip}
          setNewTip={setNewTip}
          editingTip={editingTip}
          setEditingTip={setEditingTip}
          handleAddTip={handleAddTip}
          handleDeleteTip={handleDeleteTip}
          handleEditTip={handleEditTip}
          handleSaveEdit={handleSaveEdit}
          handleResetTips={handleResetTips}
        />
      </div>
    </div>
  )
}
