import React, { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import {
  Settings2, Lock, MessageCircle, Save, Eye, EyeOff,
  LogOut, LogIn, Shield, Link, Info, Lightbulb, Plus, Trash2, RotateCcw,
  User, TrendingUp, ChevronDown, ChevronUp
} from 'lucide-react'
import AdminLogin from './AdminLogin'
import DEFAULT_TIPS from '../data/padelTips'

export default function Settings() {
  const { settings, saveSettings, isAdmin, setIsAdmin, claimedId, getPlayerById, updatePlayer, players } = useApp()

  const [form, setForm]           = useState({ whatsappLink: '', adminPin: '1234', groupName: 'Padel Lobsters' })
  const [showLogin, setShowLogin] = useState(false)
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
  const [profileForm, setProfileForm] = useState({ playtomicLevel: '', adjustment: '0', tagline: '', preferredPosition: '' })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved]   = useState(false)

  // Playtomic update popup — show if player hasn't visited settings in 30+ days
  const [showPlaytomicPrompt, setShowPlaytomicPrompt] = useState(false)

  useEffect(() => {
    if (myPlayer) {
      setProfileForm({
        playtomicLevel: String(myPlayer.playtomicLevel || ''),
        adjustment: String(myPlayer.adjustment || '0'),
        tagline: myPlayer.tagline || '',
        preferredPosition: myPlayer.preferredPosition || myPlayer.preferred_position || '',
      })
      // Check if we should prompt for Playtomic update
      const lastCheck = localStorage.getItem(`lobster_playtomic_check_${claimedId}`)
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
      if (!lastCheck || parseInt(lastCheck) < thirtyDaysAgo) {
        setShowPlaytomicPrompt(true)
      }
    }
  }, [myPlayer, claimedId])

  const handleProfileSave = async () => {
    if (!myPlayer) return
    setProfileSaving(true)
    try {
      await updatePlayer(myPlayer.id, {
        ...myPlayer,
        playtomicLevel: profileForm.playtomicLevel,
        adjustment: profileForm.adjustment,
        tagline: profileForm.tagline,
        preferredPosition: profileForm.preferredPosition,
      })
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

  const handleSave = async (e) => {
    e.preventDefault()
    if (!isAdmin) { setShowLogin(true); return }
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

  return (
    <div className="space-y-5">
      {showLogin && <AdminLogin onClose={() => setShowLogin(false)} />}

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

      {/* Admin status banner */}
      <div className={`rounded-xl p-3 flex items-center gap-3 ${isAdmin ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
        <Shield size={18} className={isAdmin ? 'text-green-600' : 'text-gray-400'} />
        <div className="flex-1">
          <p className={`text-sm font-semibold ${isAdmin ? 'text-green-700' : 'text-gray-600'}`}>
            {isAdmin ? 'Admin mode active' : 'Viewing as Player'}
          </p>
          <p className="text-xs text-gray-500">
            {isAdmin ? 'You can edit all settings and data' : 'Log in as admin to edit settings'}
          </p>
        </div>
        {isAdmin ? (
          <button
            onClick={() => setIsAdmin(false)}
            className="flex items-center gap-1 text-xs text-red-500 font-semibold bg-red-50 px-3 py-1.5 rounded-lg"
          >
            <LogOut size={12} /> Exit
          </button>
        ) : (
          <button
            onClick={() => setShowLogin(true)}
            className="flex items-center gap-1 text-xs text-lobster-teal font-semibold bg-lobster-cream px-3 py-1.5 rounded-lg"
          >
            <LogIn size={12} /> Login
          </button>
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

          {/* Expanded edit form */}
          {profileExpanded && (
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-400">Edit your full profile. Changes are saved instantly.</p>

              {/* Tagline */}
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Your Lobster Add-on</label>
                <input
                  className="input text-sm"
                  type="text"
                  maxLength={80}
                  placeholder="e.g. The one who always calls the ball out"
                  value={profileForm.tagline}
                  onChange={e => setProfileForm(f => ({ ...f, tagline: e.target.value }))}
                />
                <p className="text-[10px] text-gray-400 mt-1">Appears on your player card. {80 - profileForm.tagline.length} chars left.</p>
              </div>

              {/* Preferred position */}
              <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Preferred Side</label>
                <div className="flex gap-2">
                  {[['left', '👈 Left'], ['right', '👉 Right'], ['both', '↔️ Both']].map(([val, lbl]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setProfileForm(f => ({ ...f, preferredPosition: val }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                        profileForm.preferredPosition === val
                          ? 'bg-lobster-teal text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Playtomic level + adjustment */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Playtomic Level</label>
                  <input
                    className="input text-center font-bold"
                    type="number" step="0.01" min="0" max="10"
                    value={profileForm.playtomicLevel}
                    onChange={e => setProfileForm(f => ({ ...f, playtomicLevel: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">Adjustment (+/-)</label>
                  <input
                    className="input text-center font-bold"
                    type="number" step="0.1" min="-3" max="3"
                    value={profileForm.adjustment}
                    onChange={e => setProfileForm(f => ({ ...f, adjustment: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  Effective level: <span className="font-bold text-lobster-teal">
                    {((parseFloat(profileForm.playtomicLevel) || 0) + (parseFloat(profileForm.adjustment) || 0)).toFixed(1)}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={handleProfileSave}
                  disabled={profileSaving}
                  className="bg-lobster-teal text-white text-xs font-bold px-4 py-2 rounded-xl active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {profileSaving ? 'Saving…' : profileSaved ? '✓ Saved!' : <><Save size={13} /> Save</>}
                </button>
              </div>
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
        <img src="/logo-hd.png" alt="Padel Lobsters" className="w-14 h-14 rounded-full mx-auto mb-2" />
        <p className="font-bold text-gray-700">Padel Lobsters</p>
        <p className="text-xs text-gray-400">Tournament Manager · v1.0</p>
        <p className="text-xs text-gray-300 mt-2">Made with 🦞 for the crew</p>
      </div>
    </div>
  )
}
