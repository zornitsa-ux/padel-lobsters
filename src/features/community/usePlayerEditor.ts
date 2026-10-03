import { useMemo, useRef, useState } from 'react'
import type React from 'react'
import { useApp } from '../../context/useApp'
import { usePlayerActions, useAvatarUpload } from '../players/usePlayers'
import { randomAvatarFilename } from '../players/playerQueries'
import { processAvatar } from '../../lib/processAvatar'
import { errorMessage } from '../../lib/errors'
import { randomPrompt, emptyForm, type PlayerFormState } from './playerConstants'
import { getMissingPlayerFormFields } from './playerFormSchema'
import { buildPlayerEditPatch } from './playerPatch'
import { useResolveWithPii } from './useRevealPii'
import type { CommunityPlayer } from './playersSelectors'

// Single-word names go entirely into firstName; the admin can add a surname.
function formFromPlayer(p: CommunityPlayer): PlayerFormState {
  const nameParts = (p.name || '').trim().split(/\s+/)
  return {
    firstName: nameParts[0] || '',
    lastName: nameParts.slice(1).join(' '),
    name: p.name || '',
    email: p.email || '',
    phone: p.phone || '',
    playtomicLevel: p.playtomicLevel ?? '',
    playtomicUsername: p.playtomicUsername || '',
    notes: p.notes || '',
    gender: p.gender || '',
    isLeftHanded: p.isLeftHanded || false,
    country: p.country || '',
    avatarUrl: p.avatarUrl || '',
    birthday: p.birthday || '',
    preferredPosition: p.preferredPosition || '',
  }
}

const noop = () => {}

/** Admin edit flow for an existing player: open, resolve PII, diff, save. Spread `formProps` into <PlayerForm>. */
export function usePlayerEditor({ isAdmin }: { isAdmin: boolean }) {
  const { session, role } = useApp()
  const { updatePlayer } = usePlayerActions({ session, role })
  const uploadAvatar = useAvatarUpload()
  const resolveWithPii = useResolveWithPii()
  const lobbyPrompt = useMemo(() => randomPrompt(), [])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  // The PII-resolved record that seeded the form. Saves diff against it so an
  // untouched field can never be sent as a blank clear; null while resolving.
  const [editSource, setEditSource] = useState<CommunityPlayer | null>(null)
  const [formReady, setFormReady] = useState(true)
  const [form, setForm] = useState<PlayerFormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Opening A then B, with A's PII resolving last, must not land A's data on
  // B's form. Each open bumps the token; stale resolves are dropped.
  const editRequestRef = useRef(0)

  const close = () => {
    setShowForm(false)
    setAvatarFile(null)
    setAvatarPreview(null)
    setEditSource(null)
  }

  const openEdit = async (p: CommunityPlayer) => {
    if (!isAdmin) return
    const token = ++editRequestRef.current
    setError('')
    setAvatarFile(null)
    setAvatarPreview(null)
    setForm(emptyForm)
    setEditId(p.id)
    setEditSource(null)
    setFormReady(false)
    setShowForm(true)
    try {
      const full = await resolveWithPii(p)
      if (editRequestRef.current !== token) return
      setForm(formFromPlayer(full))
      setAvatarPreview(full.avatarUrl || null)
      setEditSource(full)
      setFormReady(true)
    } catch (err) {
      if (editRequestRef.current !== token) return
      setError(errorMessage(err, 'Could not load this player for editing.'))
      setShowForm(false)
      setEditId(null)
      setFormReady(true)
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(String(ev.target?.result ?? ''))
    reader.readAsDataURL(file)
  }

  // A failed upload is non-fatal: the player is still saved without the photo.
  const uploadNewAvatar = async (file: File): Promise<string | null> => {
    let processed: Blob
    try {
      processed = await processAvatar(file)
    } catch (err) {
      console.error('Avatar processing error:', err)
      alert('Photo could not be processed: ' + errorMessage(err))
      return null
    }
    try {
      return await uploadAvatar.mutateAsync({ file: processed, filename: randomAvatarFilename() })
    } catch (err) {
      console.error('Avatar upload error:', err)
      alert(
        'Photo could not be saved: ' +
          errorMessage(err) +
          '\n\nMake sure the "avatars" storage bucket exists and is set to public in Supabase.',
      )
      return form.avatarUrl || ''
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const missing = getMissingPlayerFormFields(form, isAdmin)
    if (missing.length > 0) {
      alert(`Please complete the following fields before registering:\n\n• ${missing.join('\n• ')}`)
      return
    }
    if (!editId || !editSource) {
      setError('Player data is still loading — try again in a moment.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const avatarUrl = avatarFile ? await uploadNewAvatar(avatarFile) : form.avatarUrl || ''
      if (avatarUrl === null) return
      const combinedName = [(form.firstName || '').trim(), (form.lastName || '').trim()]
        .filter(Boolean)
        .join(' ')
      // status is never part of a plain edit; approvals are their own action.
      const patch = buildPlayerEditPatch({
        form,
        avatarUrl,
        combinedName,
        notesPromptLabel: lobbyPrompt.label,
        source: editSource,
        activate: false,
      })
      await updatePlayer(editId, patch)
      close()
    } catch (err) {
      setError(errorMessage(err, 'Could not save player.'))
    } finally {
      setSaving(false)
    }
  }

  return {
    openEdit,
    error,
    clearError: () => setError(''),
    formProps: {
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
      formReady,
      mergePlayer: null,
      setMergePlayer: noop,
      acceptMerge: noop,
      lobbyPrompt,
      onClose: close,
    },
  }
}
