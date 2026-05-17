import React, { useState, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../supabase'
import { isE164 } from '../../lib/whatsapp'
import { Settings2 } from 'lucide-react'
import DEFAULT_TIPS from '../../data/padelTips'
import { recomputeAllRatings } from '../../lib/ratingsRecompute'
import { processAvatar } from '../../lib/processAvatar'
import { LOBBY_PROMPTS } from './settingsHelpers'
import AccountSection from './AccountSection'
import ProfileSection from './ProfileSection'
import AdminSection from './AdminSection'

export default function Settings() {
  const {
    settings,
    saveSettings,
    session,
    getPlayerById,
    updatePlayer,
    players,
    loginWithPin,
    logout,
    fetchMyProfile,
  } = useApp()
  const isAdmin = session?.user?.app_metadata?.role === 'admin'
  const claimedId = session?.user?.id ?? null

  const [form, setForm] = useState({
    whatsappLink: '',
    groupName: 'Padel Lobsters',
  })
  // ── Unified Account sign-in state ──────────────────────────
  // A single PIN field handles BOTH admin + player sign-in via auto-detect.
  const [signInPin, setSignInPin] = useState('')
  const [signInError, setSignInError] = useState('')
  const [signingIn, setSigningIn] = useState(false)

  // ── Glicko-2 ratings recompute (admin) ────────────────────────────
  const [recomputing, setRecomputing] = useState(false)
  const [recomputeResult, setRecomputeResult] = useState(null)
  const handleRecomputeRatings = async () => {
    if (recomputing) return
    setRecomputing(true)
    setRecomputeResult(null)
    try {
      const result = await recomputeAllRatings(supabase)
      setRecomputeResult({ ok: true, ...result })
    } catch (e) {
      setRecomputeResult({ ok: false, message: e.message || String(e) })
    } finally {
      setRecomputing(false)
    }
  }
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tips, setTips] = useState(null) // null = use defaults
  const [newTip, setNewTip] = useState('')
  const [editingTip, setEditingTip] = useState(null) // { index, text }
  const [tipsExpanded, setTipsExpanded] = useState(false)

  // ── My Lobster Profile ──────────────────────────────────────────────────
  const myPlayer = claimedId ? getPlayerById(claimedId) : null
  const [profileExpanded, setProfileExpanded] = useState(false)
  const [profileForm, setProfileForm] = useState({
    name: '',
    country: '',
    gender: '',
    isLeftHanded: false,
    preferredPosition: '',
    playtomicLevel: '',
    adjustment: '0',
    tagline: '',
    email: '',
    phone: '',
    birthday: '',
    avatarUrl: '',
  })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [activePrompt, setActivePrompt] = useState(2) // default to "War Cry"

  // Playtomic update popup — show if player hasn't visited settings in 30+ days
  const [showPlaytomicPrompt, setShowPlaytomicPrompt] = useState(false)

  useEffect(() => {
    if (myPlayer) {
      setProfileForm({
        name: myPlayer.name || '',
        country: myPlayer.country || '',
        gender: myPlayer.gender || '',
        isLeftHanded: myPlayer.isLeftHanded || myPlayer.is_left_handed || false,
        preferredPosition: myPlayer.preferredPosition || myPlayer.preferred_position || '',
        playtomicLevel: String(myPlayer.playtomicLevel || ''),
        adjustment: String(myPlayer.adjustment || '0'),
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

  // Securely fetch PII (email / phone / full birthday) via get_my_profile RPC.
  // Runs after the cached-player effect above, so PII overlays the (eventually
  // PII-stripped) players_public cache without a flash of empty fields.
  useEffect(() => {
    if (!claimedId) return
    let cancelled = false
    ;(async () => {
      const row = await fetchMyProfile()
      if (cancelled || !row) return
      setProfileForm((prev) => ({
        ...prev,
        email: row.email ?? prev.email ?? '',
        phone: row.phone ?? prev.phone ?? '',
        birthday: row.birthday ?? prev.birthday ?? '',
      }))
    })()
    return () => {
      cancelled = true
    }
  }, [claimedId, fetchMyProfile])

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleProfileSave = async () => {
    if (!myPlayer) return
    // Phone validation: required to be E.164 so wa.me links work for
    // transfer offers. Allow blank (the user might have an empty phone
    // on file from before this validation existed) but reject malformed
    // values when present.
    if (profileForm.phone && !isE164(profileForm.phone)) {
      alert('Phone must start with + and the country code (e.g. +31612345678).')
      return
    }
    setProfileSaving(true)
    try {
      let avatarUrl = profileForm.avatarUrl || ''
      if (avatarFile) {
        let processed
        try {
          processed = await processAvatar(avatarFile)
        } catch (err) {
          console.error('Avatar processing error:', err)
          alert('Photo could not be processed: ' + err.message)
          setProfileSaving(false)
          return
        }
        const filename = `player-${myPlayer.id}.webp`
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filename, processed, { upsert: true, contentType: 'image/webp' })
        if (uploadError) {
          console.error('Avatar upload error:', uploadError)
          alert('Photo could not be saved: ' + uploadError.message)
        } else {
          const {
            data: { publicUrl },
          } = supabase.storage.from('avatars').getPublicUrl(filename)
          // Cache buster so the CDN serves the new image immediately on re-upload.
          avatarUrl = `${publicUrl}?v=${Date.now()}`
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
        adjustment: profileForm.adjustment,
        tagline: profileForm.tagline,
        taglineLabel: LOBBY_PROMPTS[activePrompt].label,
        email: profileForm.email,
        phone: profileForm.phone,
        birthday: profileForm.birthday || null,
        avatarUrl,
      })
      setAvatarFile(null)
      localStorage.setItem(`lobster_playtomic_check_${claimedId}`, String(Date.now()))
      setShowPlaytomicPrompt(false)
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2500)
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
  const handleSignIn = async (e) => {
    e?.preventDefault?.()
    if (signingIn) return
    setSigningIn(true)
    setSignInError('')
    const result = await loginWithPin(signInPin)
    if (!result.success) {
      setSignInError(result.error || 'Sign-in failed')
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

  const handleSave = async (e) => {
    e.preventDefault()
    if (!isAdmin) return // admin-only form is hidden when not admin
    setSaving(true)
    try {
      await saveSettings({ ...form, padelTips: tips })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      alert('Could not save settings: ' + (err?.message || 'unknown error'))
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
  const persistTips = async (nextTips, prevTipsForRollback) => {
    try {
      await saveSettings({ ...form, padelTips: nextTips })
    } catch (err) {
      setTips(prevTipsForRollback) // revert UI if DB write failed
      alert('Could not save tip change: ' + (err?.message || 'unknown error'))
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

  const handleDeleteTip = (idx) => {
    const prev = tips
    const updated = activeTips.filter((_, i) => i !== idx)
    const next = updated.length > 0 ? updated : null
    setTips(next)
    persistTips(next, prev)
  }

  const handleEditTip = (idx) => {
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
  const signedInPlayer = claimedId ? getPlayerById(claimedId) : null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-lobster-teal rounded-xl flex items-center justify-center">
          <Settings2 size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-800">Settings</h2>
          <p className="text-xs text-gray-500">App configuration</p>
        </div>
      </div>

      {/*
        ── Account (unified sign-in) ───────────────────────────────────
        Single card: one PIN field handles both player and admin sign-in.
        After sign-in the session persists across every page — no more
        per-action login prompts on Merch / Tournament / etc.
      */}
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
        setProfileForm={setProfileForm}
        profileSaving={profileSaving}
        profileSaved={profileSaved}
        avatarPreview={avatarPreview}
        handleAvatarChange={handleAvatarChange}
        handleProfileSave={handleProfileSave}
        activePrompt={activePrompt}
        setActivePrompt={setActivePrompt}
        showPlaytomicPrompt={showPlaytomicPrompt}
        dismissPlaytomicPrompt={dismissPlaytomicPrompt}
      />

      {/* Settings form — admin only */}
      {isAdmin && (
        <AdminSection
          form={form}
          setForm={setForm}
          saving={saving}
          saved={saved}
          handleSave={handleSave}
          recomputing={recomputing}
          recomputeResult={recomputeResult}
          handleRecomputeRatings={handleRecomputeRatings}
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
          src="/logo-hd.png"
          alt="Padel Lobsters"
          className="w-14 h-14 rounded-full bg-white p-1 object-contain mx-auto mb-2"
        />
        <p className="font-bold text-gray-700">Padel Lobsters</p>
        <p className="text-xs text-gray-400">Tournament Manager · v1.0</p>
        <p className="text-xs text-gray-300 mt-2">Made with 🦞 for the crew</p>
      </div>
    </div>
  )
}
