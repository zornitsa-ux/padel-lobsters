import { useEffect, useState, type FormEvent } from 'react'
import { useSettings, useSaveSettings } from './useSettings'
import { errorMessage } from '../../lib/errors'
import DEFAULT_TIPS from '../../data/padelTips'
import type { EditingTip, SettingsForm } from './settingsHelpers'
import AdminSection from './AdminSection'
import { PageHeader } from '../../components/ui/PageHeader'

/** Admin-only app config: group name, WhatsApp link, security log and daily tips. */
export default function GroupSettingsPage() {
  const { data: settings } = useSettings()
  const saveSettingsMutation = useSaveSettings()
  const [form, setForm] = useState<SettingsForm>({
    whatsappLink: '',
    groupName: 'Padel Lobsters',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tips, setTips] = useState<string[] | null>(null) // null = use defaults
  const [newTip, setNewTip] = useState('')
  const [editingTip, setEditingTip] = useState<EditingTip | null>(null)
  const [tipsExpanded, setTipsExpanded] = useState(false)

  useEffect(() => {
    if (settings) {
      setForm({
        whatsappLink: settings.whatsappLink || '',
        groupName: settings.groupName || 'Padel Lobsters',
      })
      setTips(settings.padelTips && settings.padelTips.length > 0 ? settings.padelTips : null)
    }
  }, [settings])

  const activeTips = tips || DEFAULT_TIPS
  const isCustom = tips !== null

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await saveSettingsMutation.mutateAsync({ ...form, padelTips: tips })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      alert('Could not save settings: ' + errorMessage(err, 'unknown error'))
    } finally {
      setSaving(false)
    }
  }

  // Each tip change saves straight away and rolls the UI back if the write fails.
  const persistTips = async (nextTips: string[] | null, prevTipsForRollback: string[] | null) => {
    try {
      await saveSettingsMutation.mutateAsync({ ...form, padelTips: nextTips })
    } catch (err) {
      setTips(prevTipsForRollback)
      alert('Could not save tip change: ' + errorMessage(err, 'unknown error'))
    }
  }

  const handleAddTip = () => {
    if (!newTip.trim()) return
    const prev = tips
    const updated = [...activeTips, newTip.trim()]
    setTips(updated)
    setNewTip('')
    persistTips(updated, prev)
  }

  const handleDeleteTip = (idx: number) => {
    const prev = tips
    const updated = activeTips.filter((_, i) => i !== idx)
    const next = updated.length > 0 ? updated : null
    setTips(next)
    persistTips(next, prev)
  }

  const handleEditTip = (idx: number) => {
    setEditingTip({ index: idx, text: activeTips[idx] })
  }

  const handleSaveEdit = () => {
    if (!editingTip || !editingTip.text.trim()) return
    const prev = tips
    const updated = [...activeTips]
    updated[editingTip.index] = editingTip.text.trim()
    setTips(updated)
    setEditingTip(null)
    persistTips(updated, prev)
  }

  const handleResetTips = () => {
    const prev = tips
    setTips(null)
    persistTips(null, prev)
  }

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
