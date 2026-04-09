import React, { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import {
  Settings2, Lock, MessageCircle, Save, Eye, EyeOff,
  LogOut, LogIn, Shield, Link, Info, Lightbulb, Plus, Trash2, RotateCcw
} from 'lucide-react'
import AdminLogin from './AdminLogin'
import DEFAULT_TIPS from '../data/padelTips'

export default function Settings() {
  const { settings, saveSettings, isAdmin, setIsAdmin } = useApp()

  const [form, setForm]           = useState({ whatsappLink: '', adminPin: '1234', groupName: 'Padel Lobsters' })
  const [showLogin, setShowLogin] = useState(false)
  const [showPin, setShowPin]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [tips, setTips]           = useState(null) // null = use defaults
  const [newTip, setNewTip]       = useState('')
  const [editingTip, setEditingTip] = useState(null) // { index, text }
  const [tipsExpanded, setTipsExpanded] = useState(false)

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
