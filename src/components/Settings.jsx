import React, { useState, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../supabase'
import {
  Settings2, Lock, MessageCircle, Save, Eye, EyeOff,
  LogOut, LogIn, Shield, Link, Info, Lightbulb, Plus, Trash2, RotateCcw,
  User, TrendingUp, ChevronDown, ChevronUp, Camera
} from 'lucide-react'
import CountryPicker, { FlagImg } from './CountryPicker'
import DEFAULT_TIPS from '../data/padelTips'

const LOBBY_PROMPTS = [
  { label: '🎤 Trash Talk',        placeholder: 'Say something to your future opponents…' },
  { label: '🦞 Confession',        placeholder: 'Confess your deepest padel sin…' },
  { label: '💬 War Cry',           placeholder: 'What do you scream before a match?' },
  { label: '🏅 Bold Claim',        placeholder: 'Make a promise you may not keep…' },
  { label: '🎯 Battle Cry',        placeholder: 'Inspire (or scare) your opponents…' },
  { label: '😤 Excuse',            placeholder: 'Pre-write your excuse for losing today…' },
  { label: '🤝 Pledge',            placeholder: 'What do you bring to the court?' },
  { label: '👀 Scouting',          placeholder: 'Describe your playing style in one line…' },
]

export default function Settings() {
  const { settings, saveSettings, isAdmin, claimedId, getPlayerById, updatePlayer, players,
          loginWithPin, logout, fetchMyProfile } = useApp()

  const [form, setForm]           = useState({ whatsappLink: '', adminPin: '1234', groupName: 'Padel Lobsters' })
  // ── Unified Account sign-in state ──────────────────────────
  // A single PIN field handles BOTH admin + player sign-in via auto-detect.
  // This replaces the old per-page <AdminLogin> modal scattered across the app.
  const [signInPin, setSignInPin]     = useState('')
  const [signInError, setSignInError] = useState('')
  const [signingIn, setSigningIn]     = useState(false)
  // Hidden admin-only sign-in (fold-out at the bottom of the page)
  const [adminPanelOpen, setAdminPanelOpen]   = useState(false)
  const [adminPinInput, setAdminPinInput]     = useState('')
  const [adminPinError, setAdminPinError]     = useState('')
  const [adminSigningIn, setAdminSigningIn]   = useState(false)
  const [showPin, setShowPin]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [tips, setTips]           = useState(null) // null = use defaults
  const [newTip, setNewTip]       = useState('')
  const [editingTip, setEditingTip] = useState(null) // { index, text }
  const [tipsExpanded, setTipsExpanded] = useState(false)

  // ── My Lobster Profile ──────────────────────────────────────────────────
  const myPlayer = claimedId ? getPlayerById(claimedId) : null
  const [profileExpanded, setProfileExpanded] = useState(false)
  const [profileForm, setProfileForm] = useState({
    name: '', country: '', gender: '', isLeftHanded: false,
    preferredPosition: '', playtomicLevel: '', adjustment: '0',
    tagline: '', email: '', phone: '', birthday: '', avatarUrl: '',
  })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved]   = useState(false)
  const [avatarFile, setAvatarFile]       = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [activePrompt, setActivePrompt]   = useState(2) // default to "War Cry"
  const fileInputRef = useRef(null)

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
        const idx = LOBBY_PROMPTS.findIndex(p => p.label === savedLabel)
        if (idx >= 0) setActivePrompt(idx)
      }
      // Check if we should prompt for Playtomic update
      const lastCheck = localStorage.getItem(`lobster_playtomic_check_${claimedId}`)
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
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
      setProfileForm(prev => ({
        ...prev,
        email:    row.email    ?? prev.email    ?? '',
        phone:    row.phone    ?? prev.phone    ?? '',
        birthday: row.birthday ?? prev.birthday ?? '',
      }))
    })()
    return () => { cancelled = true }
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
    setProfileSaving(true)
    try {
      let avatarUrl = profileForm.avatarUrl || ''
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop()
        const filename = `player-${myPlayer.id}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('avatars').upload(filename, avatarFile, { upsert: true })
        if (uploadError) {
          console.error('Avatar upload error:', uploadError)
          alert('Photo could not be saved: ' + uploadError.message)
        } else {
          const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filename)
          avatarUrl = publicUrl
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
        adminPin:     settings.adminPin     || '1234',
        groupName:    settings.groupName    || 'Padel Lobsters',
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

  // ── Admin sign-in handler (fold-out) ──────────────────────────────────
  const handleAdminSignIn = async (e) => {
    e?.preventDefault?.()
    if (adminSigningIn) return
    setAdminSigningIn(true)
    setAdminPinError('')
    const result = await loginWithPin(adminPinInput)
    if (!result.success || result.role !== 'admin') {
      // Don't reveal which kind of failure this was.
      setAdminPinError('Incorrect admin PIN.')
      setAdminPinInput('')
    } else {
      setAdminPinInput('')
      setAdminPanelOpen(false)
    }
    setAdminSigningIn(false)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!isAdmin) return // admin-only form is hidden when not admin
    setSaving(true)
    try {
      await saveSettings({ ...form, padelTips: tips })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  const handleAddTip = () => {
    if (!newTip.trim()) return
    const updated = [...activeTips, newTip.trim()]
    setTips(updated)
    setNewTip('')
  }

  const handleDeleteTip = (idx) => {
    const updated = activeTips.filter((_, i) => i !== idx)
    setTips(updated.length > 0 ? updated : null)
  }

  const handleEditTip = (idx) => {
    setEditingTip({ index: idx, text: activeTips[idx] })
  }

  const handleSaveEdit = () => {
    if (!editingTip || !editingTip.text.trim()) return
    const updated = [...activeTips]
    updated[editingTip.index] = editingTip.text.trim()
    setTips(updated)
    setEditingTip(null)
  }

  const handleResetTips = () => {
    setTips(null)
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
        per-action login prompts on Merch / Updates / Tournament / etc.
      */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-lobster-teal/10 rounded-lg flex items-center justify-center">
            {isAdmin ? <Shield size={16} className="text-lobster-teal" /> :
             signedInPlayer ? <User size={16} className="text-lobster-teal" /> :
                              <LogIn size={16} className="text-lobster-teal" />}
          </div>
          <div>
            <h3 className="font-bold text-gray-700 text-sm">Account</h3>
            <p className="text-[11px] text-gray-400">One sign-in, works across the whole site</p>
          </div>
        </div>

        {isAdmin ? (
          // ── Signed in as admin ──────────────────────────────────
          <div className="rounded-xl border border-green-200 bg-green-50 p-3 flex items-center gap-3">
            <Shield size={18} className="text-green-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-700">Admin mode active 🛡️</p>
              <p className="text-xs text-gray-500">
                {signedInPlayer ? `Also signed in as ${signedInPlayer.name.split(' ')[0]}` : 'You can edit all data'}
              </p>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1 text-xs text-red-500 font-semibold bg-red-50 px-3 py-1.5 rounded-lg active:scale-95 transition-all"
            >
              <LogOut size={12} /> Sign out
            </button>
          </div>
        ) : signedInPlayer ? (
          // ── Signed in as player ─────────────────────────────────
          <div className="rounded-xl border border-lobster-teal/30 bg-lobster-cream p-3 flex items-center gap-3">
            {signedInPlayer.avatarUrl ? (
              <img src={signedInPlayer.avatarUrl} alt={signedInPlayer.name}
                   className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-white" />
            ) : (
              <div className="w-9 h-9 bg-lobster-teal rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {signedInPlayer.name[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">
                Signed in as {signedInPlayer.name} <span className="text-lobster-teal text-xs">✓</span>
              </p>
              <p className="text-xs text-gray-500">You can post updates, place orders, and react anywhere on the site.</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1 text-xs text-red-500 font-semibold bg-white px-3 py-1.5 rounded-lg active:scale-95 transition-all"
            >
              <LogOut size={12} /> Sign out
            </button>
          </div>
        ) : (
          // ── Guest — player PIN sign-in ──────────────────────────
          <form onSubmit={handleSignIn} className="space-y-3">
            <div className="text-center py-2">
              <div className="text-3xl mb-1">🦞</div>
              <p className="text-sm font-semibold text-gray-800">Enter your 4-digit Lobster PIN</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                It's the code you got via WhatsApp when you joined the crew.
              </p>
            </div>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              placeholder="• • • •"
              className="input text-center text-2xl tracking-[0.5em] font-bold"
              value={signInPin}
              onChange={e => { setSignInPin(e.target.value.replace(/\D/g, '').slice(0, 8)); setSignInError('') }}
              autoFocus
            />
            {signInError && (
              <p className="text-xs text-red-500 text-center font-medium">{signInError}</p>
            )}
            <button
              type="submit"
              disabled={signingIn || signInPin.length < 4}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <LogIn size={14} />
              {signingIn ? 'Signing in…' : 'Sign in'}
            </button>
            <p className="text-[11px] text-gray-400 text-center">
              Lost your PIN? Ask an admin to resend it from the Players page.
            </p>
          </form>
        )}
      </div>

      {/* ── Playtomic update popup ─────────────────────────────── */}
      {showPlaytomicPrompt && myPlayer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-xl">
            <div className="text-center">
              <div className="text-4xl mb-2">🦞</div>
              <h3 className="text-lg font-bold text-gray-800">Has your Playtomic score changed?</h3>
              <p className="text-sm text-gray-500 mt-1">
                It's been a while! Your current level on file:
              </p>
            </div>
            <div className="bg-lobster-cream rounded-2xl p-4 text-center">
              <p className="text-3xl font-bold text-lobster-teal">
                {(parseFloat(myPlayer.playtomicLevel) || 0).toFixed(1)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Adjustment: {parseFloat(myPlayer.adjustment) >= 0 ? '+' : ''}{myPlayer.adjustment || 0}
                {' → '}
                <span className="font-bold text-gray-600">
                  {((parseFloat(myPlayer.playtomicLevel) || 0) + (parseFloat(myPlayer.adjustment) || 0)).toFixed(1)}
                </span>
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">New Playtomic Level</label>
                <input
                  className="input text-center text-lg font-bold"
                  type="number" step="0.01" min="0" max="10"
                  value={profileForm.playtomicLevel}
                  onChange={e => setProfileForm(f => ({ ...f, playtomicLevel: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Adjustment (+/-)</label>
                <input
                  className="input text-center text-lg font-bold"
                  type="number" step="0.1" min="-3" max="3"
                  value={profileForm.adjustment}
                  onChange={e => setProfileForm(f => ({ ...f, adjustment: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={dismissPlaytomicPrompt}
                className="flex-1 text-sm font-semibold text-gray-500 py-2.5 rounded-xl border border-gray-200 active:scale-95 transition-all"
              >
                No change
              </button>
              <button
                type="button"
                onClick={handleProfileSave}
                disabled={profileSaving}
                className="flex-1 bg-lobster-teal text-white text-sm font-bold py-2.5 rounded-xl active:scale-95 transition-all disabled:opacity-50"
              >
                {profileSaving ? 'Saving…' : 'Update'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── My Lobster Profile (for claimed players) ──────────── */}
      {myPlayer && (
        <div className="card space-y-3">
          <button
            type="button"
            onClick={() => setProfileExpanded(e => !e)}
            className="w-full flex items-center justify-between"
          >
            <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
              <User size={15} className="text-lobster-orange" /> My Lobster Profile
            </h3>
            {profileExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </button>

          {/* Always-visible summary */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-lobster-teal rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
              {myPlayer.avatarUrl ? (
                <img src={myPlayer.avatarUrl} alt={myPlayer.name} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                (myPlayer.name || '?')[0].toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 truncate">{myPlayer.name}</p>
              <p className="text-xs text-gray-500">
                Level: <span className="font-bold text-lobster-teal">{((parseFloat(myPlayer.playtomicLevel) || 0) + (parseFloat(myPlayer.adjustment) || 0)).toFixed(1)}</span>
                <span className="text-gray-400 ml-1">
                  (Playtomic {(parseFloat(myPlayer.playtomicLevel) || 0).toFixed(1)} {parseFloat(myPlayer.adjustment) >= 0 ? '+' : ''}{myPlayer.adjustment || 0})
                </span>
              </p>
            </div>
          </div>

          {/* Expanded full edit form */}
          {profileExpanded && (
            <div className="space-y-4 pt-2 border-t border-gray-100">

              {/* Avatar upload */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Preview"
                      className="w-20 h-20 rounded-full object-cover border-2 border-lobster-teal" />
                  ) : (
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300">
                      <User size={28} />
                    </div>
                  )}
                  <button type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 w-7 h-7 bg-lobster-teal rounded-full flex items-center justify-center text-white shadow-sm active:scale-95">
                    <Camera size={13} />
                  </button>
                </div>
                <p className="text-xs text-gray-400">Tap camera icon to change photo</p>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>

              {/* Full Name */}
              <div>
                <label className="label">Full Name</label>
                <input className="input" placeholder="e.g. Augustin Tapia" value={profileForm.name}
                  onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              {/* War Cry — toggleable prompt categories */}
              <div>
                <label className="label">War Cry</label>
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {LOBBY_PROMPTS.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActivePrompt(i)}
                      className={`text-[11px] px-2.5 py-1 rounded-full font-semibold transition-all active:scale-95 ${
                        activePrompt === i
                          ? 'bg-lobster-teal text-white'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <input className="input" type="text" maxLength={80}
                  placeholder={LOBBY_PROMPTS[activePrompt].placeholder}
                  value={profileForm.tagline}
                  onChange={e => setProfileForm(f => ({ ...f, tagline: e.target.value }))} />
                <p className="text-xs text-gray-400 mt-1">Appears on your player card. {80 - profileForm.tagline.length} chars left.</p>
              </div>

              {/* Country */}
              <div>
                <label className="label">Country</label>
                <CountryPicker
                  value={profileForm.country}
                  onChange={val => setProfileForm(f => ({ ...f, country: val }))}
                />
              </div>

              {/* Gender */}
              <div>
                <label className="label">Gender</label>
                <p className="text-xs text-gray-400 mb-2">For optimal pair matching</p>
                <div className="flex gap-3">
                  {[['male', 'Male'], ['female', 'Female']].map(([val, lbl]) => (
                    <button type="button" key={val}
                      onClick={() => setProfileForm(f => ({ ...f, gender: f.gender === val ? '' : val }))}
                      className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                        profileForm.gender === val ? 'bg-lobster-teal text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Left-handed */}
              <div>
                <label className="label">Playing Hand</label>
                <button type="button"
                  onClick={() => setProfileForm(f => ({ ...f, isLeftHanded: !f.isLeftHanded }))}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all w-full justify-center ${
                    profileForm.isLeftHanded
                      ? 'bg-amber-100 text-amber-700 border-2 border-amber-300'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                  🤚 {profileForm.isLeftHanded ? 'Left-handed (tap to undo)' : 'Tap if left-handed'}
                </button>
              </div>

              {/* Preferred side */}
              <div>
                <label className="label">Preferred Side</label>
                <div className="flex gap-2">
                  {[['left', '👈 Left'], ['right', '👉 Right'], ['both', '↔️ Both']].map(([val, lbl]) => (
                    <button type="button" key={val}
                      onClick={() => setProfileForm(f => ({ ...f, preferredPosition: f.preferredPosition === val ? '' : val }))}
                      className={`flex-1 py-2 rounded-xl font-semibold text-sm transition-all ${
                        profileForm.preferredPosition === val ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Playtomic level + adjustment */}
              <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Playtomic Level</p>
                <div>
                  <label className="label">Playtomic Level (0–7)</label>
                  <input type="number" step="0.1" min="0" max="7" className="input" placeholder="e.g. 3.5"
                    value={profileForm.playtomicLevel}
                    onChange={e => setProfileForm(f => ({ ...f, playtomicLevel: e.target.value }))} />
                  <p className="text-xs text-gray-500 mt-1">Check your Playtomic app — it shows your current level</p>
                </div>
                <div>
                  <label className="label">Personal Adjustment</label>
                  <input type="number" step="0.1" min="-3" max="3" className="input" placeholder="0"
                    value={profileForm.adjustment}
                    onChange={e => setProfileForm(f => ({ ...f, adjustment: e.target.value }))} />
                  <p className="text-xs text-gray-500 mt-1">
                    Positive = stronger · Negative = weaker<br />
                    Adjusted Level = {((parseFloat(profileForm.playtomicLevel) || 0) + (parseFloat(profileForm.adjustment) || 0)).toFixed(1)}
                  </p>
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" placeholder="player@email.com" value={profileForm.email}
                  onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))} />
                <p className="text-xs text-gray-400 mt-1">Visible for organizers only</p>
              </div>

              {/* Phone */}
              <div>
                <label className="label">Phone / WhatsApp</label>
                <input type="tel" className="input" placeholder="+31 6 12345678" value={profileForm.phone}
                  onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} />
                <p className="text-xs text-gray-400 mt-1">Visible for organizers only</p>
              </div>

              {/* Birthday */}
              <div>
                <label className="label">Birthday 🎂</label>
                <input type="date" className="input" value={profileForm.birthday || ''}
                  onChange={e => setProfileForm(f => ({ ...f, birthday: e.target.value }))} />
              </div>

              {/* Save button */}
              <button
                type="button"
                onClick={handleProfileSave}
                disabled={profileSaving}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <Save size={16} />
                {profileSaving ? 'Saving…' : profileSaved ? '✓ Saved!' : 'Save Profile'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Settings form */}
      <form onSubmit={handleSave} className="space-y-4">

        {/* Group info */}
        <div className="card space-y-4">
          <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
            <Info size={15} className="text-lobster-teal" /> Group Info
          </h3>
          <div>
            <label className="label">Group Name</label>
            <input
              className="input"
              placeholder="Padel Lobsters"
              value={form.groupName}
              onChange={e => setForm(f => ({ ...f, groupName: e.target.value }))}
              disabled={!isAdmin}
            />
          </div>
        </div>

        {/* WhatsApp */}
        <div className="card space-y-4">
          <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
            <MessageCircle size={15} className="text-green-600" /> WhatsApp Community
          </h3>
          <div>
            <label className="label">Invite Link</label>
            <input
              className="input"
              type="url"
              placeholder="https://chat.whatsapp.com/xxxxxxxxxx"
              value={form.whatsappLink}
              onChange={e => setForm(f => ({ ...f, whatsappLink: e.target.value }))}
              disabled={!isAdmin}
            />
            <p className="text-xs text-gray-400 mt-1.5">
              Opens in WhatsApp when tapped in the header. Find it in your WhatsApp group → Invite via link.
            </p>
          </div>
          {form.whatsappLink && (
            <a
              href={form.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-green-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl w-fit active:scale-95 transition-all"
            >
              <MessageCircle size={16} />
              Open WhatsApp Community
            </a>
          )}
        </div>

        {/* Security — admin only */}
        {isAdmin && (
          <div className="card space-y-4">
            <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
              <Lock size={15} className="text-lobster-teal" /> Admin Security
            </h3>
            <div>
              <label className="label">Admin PIN</label>
              <div className="relative">
                <input
                  className="input pr-11"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="Enter new PIN"
                  value={form.adminPin}
                  onChange={e => setForm(f => ({ ...f, adminPin: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">
                Used to access admin features like adding players, editing data, and generating schedules.
              </p>
            </div>
          </div>
        )}

        {/* Padel Tips */}
        {isAdmin && (
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                <Lightbulb size={15} className="text-amber-500" /> Padel Tips
              </h3>
              <div className="flex items-center gap-2">
                {isCustom && (
                  <button type="button" onClick={handleResetTips} className="flex items-center gap-1 text-[10px] text-gray-400 font-semibold">
                    <RotateCcw size={10} /> Reset to defaults
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setTipsExpanded(e => !e)}
                  className="text-xs text-lobster-teal font-semibold"
                >
                  {tipsExpanded ? 'Collapse' : `View all (${activeTips.length})`}
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              One tip shows per day on the home page. {isCustom ? 'Using custom tips.' : 'Using 50 default tips.'} Hit Save to apply changes.
            </p>

            {/* Add new tip */}
            <div className="flex gap-2">
              <input
                className="input flex-1 text-xs"
                placeholder="Add a new tip..."
                value={newTip}
                onChange={e => setNewTip(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTip())}
              />
              <button type="button" onClick={handleAddTip} className="bg-lobster-teal text-white px-3 rounded-xl text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all">
                <Plus size={14} /> Add
              </button>
            </div>

            {/* Tips list */}
            {tipsExpanded && (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {activeTips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2 bg-gray-50 rounded-xl px-3 py-2 group">
                    <span className="text-[10px] text-gray-400 font-mono mt-0.5 flex-shrink-0 w-5">{i + 1}</span>
                    {editingTip?.index === i ? (
                      <div className="flex-1 flex gap-1">
                        <input
                          className="input flex-1 text-xs py-1"
                          value={editingTip.text}
                          onChange={e => setEditingTip(prev => ({ ...prev, text: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                          autoFocus
                        />
                        <button type="button" onClick={handleSaveEdit} className="text-xs text-green-600 font-semibold px-2">Save</button>
                        <button type="button" onClick={() => setEditingTip(null)} className="text-xs text-gray-400 font-semibold px-1">Cancel</button>
                      </div>
                    ) : (
                      <>
                        <p className="flex-1 text-xs text-gray-600 leading-relaxed cursor-pointer" onClick={() => handleEditTip(i)}>
                          {tip}
                        </p>
                        <button type="button" onClick={() => handleDeleteTip(i)} className="text-gray-300 hover:text-red-500 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Save button */}
        {isAdmin && (
          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <Save size={16} />
            {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Settings'}
          </button>
        )}
      </form>

      {/* App info */}
      <div className="card text-center space-y-1 py-5">
        <img src="/logo-hd.png" alt="Padel Lobsters" className="w-14 h-14 rounded-full bg-white p-1 object-contain mx-auto mb-2" />
        <p className="font-bold text-gray-700">Padel Lobsters</p>
        <p className="text-xs text-gray-400">Tournament Manager · v1.0</p>
        <p className="text-xs text-gray-300 mt-2">Made with 🦞 for the crew</p>
      </div>

      {/* ── Group Owner Access (discrete admin fold-out) ─────────────────
          Hidden by default — only group owners know to look for this.
          Players never need to interact with this section. */}
      {!isAdmin && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setAdminPanelOpen(o => !o)}
            className="w-full text-[11px] text-gray-300 hover:text-gray-500 transition-colors flex items-center justify-center gap-1.5 py-2"
          >
            <Lock size={10} className="opacity-60" />
            Group owner access
            {adminPanelOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          {adminPanelOpen && (
            <form onSubmit={handleAdminSignIn} className="card space-y-3 mt-1 border border-gray-100">
              <p className="text-[11px] text-gray-400 text-center">
                Enter the group owner PIN to manage events, players, and settings.
              </p>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                placeholder="• • • •"
                className="input text-center text-lg tracking-[0.4em] font-bold"
                value={adminPinInput}
                onChange={e => { setAdminPinInput(e.target.value.replace(/\D/g, '').slice(0, 8)); setAdminPinError('') }}
                autoFocus
              />
              {adminPinError && (
                <p className="text-xs text-red-500 text-center font-medium">{adminPinError}</p>
              )}
              <button
                type="submit"
                disabled={adminSigningIn || adminPinInput.length < 4}
                className="w-full text-xs font-semibold text-white bg-gray-700 py-2 rounded-xl active:scale-95 transition-all disabled:opacity-40"
              >
                {adminSigningIn ? 'Checking…' : 'Unlock owner mode'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
