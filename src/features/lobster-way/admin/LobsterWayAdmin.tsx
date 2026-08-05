import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Save, RotateCcw } from 'lucide-react'
import { PageHeader } from '../../../components/ui/PageHeader'
import { SignInBanner } from '../../../components/ui/AuthGate'
import { useApp } from '../../../context/useApp'
import { useSettings, useSaveSettings } from '../../settings/useSettings'
import STATIC_LOBSTER_WAY_CONTENT, {
  resolveLobsterWayContent,
  type LobsterWayCategory,
} from '../../../data/lobsterWayContent'
import { moveItem, removeAt, replaceAt } from '../../../lib/arrayReorder'
import LobsterWayAdminCategory, { emptyCategory } from './LobsterWayAdminCategory'

// Admin editor for "The Lobster Way" — add/edit/delete/reorder categories
// and questions. Persists to settings.lobster_way_content (see
// resolveLobsterWayContent), the same column the public page reads from.
export default function LobsterWayAdmin() {
  const navigate = useNavigate()
  const { session } = useApp()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const { data: settings } = useSettings()
  const saveSettingsMutation = useSaveSettings()

  const [content, setContent] = useState<LobsterWayCategory[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  // Once the admin touches the editor it's "dirty"; the seed effect below
  // then stops re-initialising from settings so a background refetch can't
  // stomp an in-progress edit (same guard Settings.tsx uses for the profile
  // form).
  const dirty = useRef(false)

  useEffect(() => {
    if (dirty.current || !settings) return
    setContent(resolveLobsterWayContent(settings))
  }, [settings])

  // Every caller updates from the current list, so the updater takes a
  // non-null array; the null case (settings not loaded yet) is a no-op and
  // is unreachable in practice because the editor only renders once content
  // is seeded.
  const update = (updater: (prev: LobsterWayCategory[]) => LobsterWayCategory[]) => {
    dirty.current = true
    setContent((prev) => (prev ? updater(prev) : prev))
    setSaved(false)
  }

  const setCategory = (i: number, next: LobsterWayCategory) =>
    update((prev) => replaceAt(prev, i, next))
  const moveCategory = (i: number, dir: number) => update((prev) => moveItem(prev, i, dir))
  const deleteCategory = (i: number) => {
    if (!confirm('Delete this category and all its questions?')) return
    update((prev) => removeAt(prev, i))
  }
  const addCategory = () => update((prev) => [...prev, emptyCategory()])

  const handleReset = () => {
    if (!confirm('Reset to the default Lobster Way content? This discards custom edits.')) return
    update(() => STATIC_LOBSTER_WAY_CONTENT)
  }

  const handleSave = async () => {
    if (!content) return
    setSaving(true)
    try {
      await saveSettingsMutation.mutateAsync({
        whatsappLink: settings?.whatsappLink,
        groupName: settings?.groupName,
        lobsterWayContent: content,
      })
      dirty.current = false
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      alert('Could not save: ' + ((err as Error)?.message || 'unknown error'))
    } finally {
      setSaving(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="-mx-4">
        <PageHeader title="The Lobster way" backLink={{ to: '/admin', label: 'Admin' }} />
        <div className="px-4 pt-4">
          <SignInBanner
            role="admin"
            onNavigate={(page: string) => page === 'settings' && navigate('/account')}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="-mx-4">
      <PageHeader
        title="Edit The Lobster way"
        eyebrow="Admin"
        backLink={{ to: '/admin', label: 'Admin' }}
      />

      <div className="px-4 pt-4 pb-8 space-y-3">
        <p className="text-xs text-gray-400">
          Changes save to the live FAQ page once you tap Save — nothing updates for players until
          then.
        </p>

        {!content ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <>
            {content.map((category, i) => (
              <LobsterWayAdminCategory
                key={category.slug}
                category={category}
                index={i}
                count={content.length}
                onChange={(next) => setCategory(i, next)}
                onMove={(dir) => moveCategory(i, dir)}
                onDelete={() => deleteCategory(i)}
              />
            ))}

            <button
              type="button"
              onClick={addCategory}
              className="w-full flex items-center justify-center gap-1.5 text-sm text-lob-teal font-semibold border border-dashed border-lob-teal/40 rounded-xl py-3"
            >
              <Plus size={14} /> Add category
            </button>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <Save size={16} />
                {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1 text-xs text-gray-400 font-semibold px-2"
              >
                <RotateCcw size={11} /> Reset to defaults
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
