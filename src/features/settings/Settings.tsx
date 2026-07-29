import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { useApp } from '../../context/useApp'
import { useSettings, useSaveSettings } from './useSettings'
import { useMyProfile, usePlayerActions, useAvatarUpload } from '../players/usePlayers'
import { isE164 } from '../../lib/whatsapp'
import { errorMessage } from '../../lib/errors'
import DEFAULT_TIPS from '../../data/padelTips'
import { processAvatar } from '../../lib/processAvatar'
import {
  LOBBY_PROMPTS,
  type EditingTip,
  type ProfileForm,
  type SettingsForm,
} from './settingsHelpers'
import AccountSection from './AccountSection'
import ProfileSection from './ProfileSection'
import AccountStatsSection from './AccountStatsSection'
import AccountOrdersSection from './AccountOrdersSection'
import AdminSection from './AdminSection'
import { PageHeader } from '../../components/ui/PageHeader'

export default function Settings() {
  const { session, role, loginWithPin, logout } = useApp()
  const { updatePlayer } = usePlayerActions({ session, role })
  const avatarUpload = useAvatarUpload()
  const { data: settings } = useSettings()
  const saveSettingsMutation = useSaveSettings()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const claimedId = session?.user?.id ?? null
  // Own profile: identity from the public roster (works on untrusted devices)
  // merged with PII from the trust-gated RPC. Single source — no separate
  // poll/overlay, so a background refetch can't flash or stomp the form.
  const { data: myPlayer } = useMyProfile(claimedId)

  const [form, setForm] = useState<SettingsForm>({
    whatsappLink: '',
    groupName: 'Padel Lobsters',
  })
  // ── Unified Account sign-in state ──────────────────────────
  // A single PIN field handles BOTH admin + player sign-in via auto-detect.
  const [signInPin, setSignInPin] = useState('')
  const [signInError, setSignInError] = useState('')
  const [signingIn, setSigningIn] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tips, setTips] = useState<string[] | null>(null) // null = use defaults
  const [newTip, setNewTip] = useState('')
  const [editingTip, setEditingTip] = useState<EditingTip | null>(null)
  const [tipsExpanded, setTipsExpanded] = useState(false)

  // ── My Lobster Profile ──────────────────────────────────────────────────
  const [profileExpanded, setProfileExpanded] = useState(false)
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    name: '',
    country: '',
    gender: '',
    isLeftHanded: false,
    preferredPosition: '',
    playtomicLevel: '',
    tagline: '',
    email: '',
    phone: '',
    birthday: '',
    avatarUrl: '',
  })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileError, setProfileError] = useState('')
  // Once the user touches the form it's "dirty"; the seed effect below then
  // stops re-initialising from myPlayer so a background refetch / cache
  // invalidation cannot wipe out unsaved edits. Reset to false after a
  // successful save so the form re-seeds from the server's saved values.
  const profileDirty = useRef(false)
  const editProfileForm = useCallback((updater: (form: ProfileForm) => ProfileForm) => {
    profileDirty.current = true
    setProfileForm(updater)
  }, [])
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [activePrompt, setActivePrompt] = useState(2) // default to "War Cry"

  // Playtomic update popup — show if player hasn't visited settings in 30+ days
  const [showPlaytomicPrompt, setShowPlaytomicPrompt] = useState(false)

  // Seed the form from myPlayer (roster identity + PII, already merged by
  // useMyProfile). Skipped once the form is dirty so an in-flight edit is never
  // overwritten by a refetch.
  useEffect(() => {
    if (profileDirty.current) return
    if (myPlayer) {
      setProfileForm({
        name: myPlayer.name || '',
        country: myPlayer.country || '',
        gender: myPlayer.gender || '',
        isLeftHanded: myPlayer.isLeftHanded || myPlayer.is_left_handed || false,
        preferredPosition: myPlayer.preferredPosition || myPlayer.preferred_position || '',
        playtomicLevel: myPlayer.playtomicLevel > 0 ? String(myPlayer.playtomicLevel) : '',
        tagline: myPlayer.tagline || '',
        email: myPlayer.email || '',
        phone: myPlayer.phone || '',
        birthday: myPlayer.birthday || '',
        avatarUrl: myPlayer.avatarUrl || myPlayer.avatar_url || '',
      })
      setAvatarPreview(myPlayer.avatarUrl || myPlayer.avatar_url || null)
      // Restore selected prompt category
      const savedLabel = myPlayer.taglineLabel || myPlayer.tagline_label || ''
      if (savedLabel) {
        const idx = LOBBY_PROMPTS.findIndex((p) => p.label === savedLabel)
        if (idx >= 0) setActivePrompt(idx)
      }
      // Check if we should prompt for Playtomic update
      const lastCheck = localStorage.getItem(`lobster_playtomic_check_${claimedId}`)
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
      if (!lastCheck || parseInt(lastCheck) < thirtyDaysAgo) {
        setShowPlaytomicPrompt(true)
      }
    }
  }, [myPlayer, claimedId])

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    profileDirty.current = true
    setAvatarFile(file)
    const reader = new FileReader()
    // readAsDataURL always yields a string; the guard is for the union type.
    reader.onload = (ev) => {
      const { result } = ev.target ?? {}
      setAvatarPreview(typeof result === 'string' ? result : null)
    }
    reader.readAsDataURL(file)
  }

  const handleProfileSave = async () => {
    if (!myPlayer) return
    // Phone validation: required to be E.164 so wa.me links work for
    // transfer offers. Allow blank (the user might have an empty phone
    // on file from before this validation existed) but reject malformed
    // values when present.
    if (profileForm.phone && !isE164(profileForm.phone)) {
      setProfileError('Phone must start with + and the country code (e.g. +31612345678).')
      return
    }
    const pt = parseFloat(profileForm.playtomicLevel)
    if (profileForm.playtomicLevel !== '' && (isNaN(pt) || pt < 0.5)) {
      setProfileError('Playtomic level must be at least 0.5')
      return
    }
    setProfileSaving(true)
    setProfileError('')
    try {
      let avatarUrl = profileForm.avatarUrl || ''
      if (avatarFile) {
        let processed: Blob
        try {
          processed = await processAvatar(avatarFile)
        } catch (err) {
          console.error('Avatar processing error:', err)
          alert('Photo could not be processed: ' + errorMessage(err))
          setProfileSaving(false)
          return
        }
        // A failed upload is non-fatal: the profile still saves, just with the
        // previous photo.
        try {
          const publicUrl = await avatarUpload.mutateAsync({
            file: processed,
            // Stable filename (upsert) so a player only ever has one avatar
            // object; the cache buster makes the CDN serve the new one.
            filename: `player-${myPlayer.id}.webp`,
          })
          avatarUrl = `${publicUrl}?v=${Date.now()}`
        } catch (err) {
          console.error('Avatar upload error:', err)
          alert('Photo could not be saved: ' + errorMessage(err))
        }
      }
      await updatePlayer(myPlayer.id, {
        ...myPlayer,
        name: profileForm.name,
        country: profileForm.country,
        gender: profileForm.gender,
        isLeftHanded: profileForm.isLeftHanded,
        preferredPosition: profileForm.preferredPosition,
        playtomicLevel: profileForm.playtomicLevel,
        tagline: profileForm.tagline,
        taglineLabel: LOBBY_PROMPTS[activePrompt].label,
        // email intentionally not included — self-service email change
        // routes through requestMyEmailChange (Supabase confirmation flow).
        phone: profileForm.phone,
        birthday: profileForm.birthday || null,
        avatarUrl,
      })
      setAvatarFile(null)
      // Edits are persisted — clear dirty so the seed effect can re-initialise
      // from the freshly-invalidated server values.
      profileDirty.current = false
      localStorage.setItem(`lobster_playtomic_check_${claimedId}`, String(Date.now()))
      setShowPlaytomicPrompt(false)
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2500)
    } catch (err) {
      setProfileError(errorMessage(err, 'Could not save profile.'))
    } finally {
      setProfileSaving(false)
    }
  }

  const dismissPlaytomicPrompt = () => {
    localStorage.setItem(`lobster_playtomic_check_${claimedId}`, String(Date.now()))
    setShowPlaytomicPrompt(false)
  }

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

  // ── Player sign-in handler (player PINs only) ─────────────────────────
  // Admin login is intentionally NOT exposed in this field — see the
  // discrete fold-out at the bottom of the page (Group Owner Access).
  // This keeps the UI focused for the 99% case (a player verifying their
  // identity) and avoids giving away the admin entry point.
  const handleSignIn = async (e: FormEvent) => {
    e?.preventDefault?.()
    if (signingIn) return
    setSigningIn(true)
    setSignInError('')
    const result = await loginWithPin(signInPin)
    if (!result.success) {
      // loginWithPin's `error` is typed unknown by AppContext; the auth API
      // only ever puts a string there.
      setSignInError(
        typeof result.error === 'string' && result.error ? result.error : 'Sign-in failed',
      )
      setSignInPin('')
    } else if (result.role === 'admin') {
      // If somebody happens to type the admin PIN in the player field,
      // treat it as wrong — we don't want to encourage that behaviour and
      // we don't want to surface the admin role here.
      logout()
      setSignInError("That PIN didn't match any Lobster — double-check and try again.")
      setSignInPin('')
    } else {
      setSignInPin('')
    }
    setSigningIn(false)
  }

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!isAdmin) return // admin-only form is hidden when not admin
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

  // ── Tip CRUD ─────────────────────────────────────────────────────────
  // Each tip change auto-saves to the DB immediately. Previously, edits
  // were only held in local state until the admin remembered to scroll
  // down and click "Save Settings" — a forgotten click meant the delete
  // was lost on the next page load and the old tip reappeared. Errors
  // now roll back the optimistic UI so the admin sees the true state.
  const persistTips = async (nextTips: string[] | null, prevTipsForRollback: string[] | null) => {
    try {
      await saveSettingsMutation.mutateAsync({ ...form, padelTips: nextTips })
    } catch (err) {
      setTips(prevTipsForRollback) // revert UI if DB write failed
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

  // Active sign-in session — used by the Account card.
  const signedInPlayer = myPlayer

  return (
    <div className="-mx-4">
      <PageHeader title="Account" />

      <div className="px-4 pt-4 space-y-5">
        <AccountSection
          isAdmin={isAdmin}
          signedInPlayer={signedInPlayer}
          logout={logout}
          signInPin={signInPin}
          setSignInPin={setSignInPin}
          signInError={signInError}
          setSignInError={setSignInError}
          signingIn={signingIn}
          handleSignIn={handleSignIn}
        />

        <ProfileSection
          myPlayer={myPlayer}
          profileExpanded={profileExpanded}
          setProfileExpanded={setProfileExpanded}
          profileForm={profileForm}
          setProfileForm={editProfileForm}
          profileSaving={profileSaving}
          profileSaved={profileSaved}
          profileError={profileError}
          avatarPreview={avatarPreview}
          handleAvatarChange={handleAvatarChange}
          handleProfileSave={handleProfileSave}
          activePrompt={activePrompt}
          setActivePrompt={setActivePrompt}
          showPlaytomicPrompt={showPlaytomicPrompt}
          dismissPlaytomicPrompt={dismissPlaytomicPrompt}
        />

        <AccountStatsSection claimedId={claimedId} />

        <AccountOrdersSection myPlayer={myPlayer} />

        {/* App config — admin only */}
        {isAdmin && (
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
        )}

        {/* App info */}
        <div className="card text-center space-y-1 py-5">
          <img
            src="/logo-256.webp"
            alt="Padel Lobsters"
            width="56"
            height="56"
            className="w-14 h-14 rounded-full bg-white p-1 object-contain mx-auto mb-2"
          />
          <p className="font-bold text-lob-slate">Padel Lobsters</p>
          <p className="text-xs text-lob-muted-light">Tournament Manager · v1.0</p>
          <p className="text-xs text-lob-muted-light/60 mt-2">Made with 🦞 for the crew</p>
        </div>
      </div>
    </div>
  )
}
