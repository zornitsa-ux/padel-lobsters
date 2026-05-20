import React from 'react'
import {
  MessageCircle,
  Save,
  Info,
  Lightbulb,
  Plus,
  Trash2,
  RotateCcw,
  TrendingUp,
} from 'lucide-react'
import AdminSecurityPanels from '../../components/AdminSecurityPanels'

export default function AdminSection({
  form,
  setForm,
  saving,
  saved,
  handleSave,
  // Glicko-2 recompute
  recomputing,
  recomputeResult,
  handleRecomputeRatings,
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
}) {
  return (
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
            onChange={(e) => setForm((f) => ({ ...f, groupName: e.target.value }))}
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
            onChange={(e) => setForm((f) => ({ ...f, whatsappLink: e.target.value }))}
          />
          <p className="text-xs text-gray-400 mt-1.5">
            Opens in WhatsApp when tapped in the header. Find it in your WhatsApp group → Invite via
            link.
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

      {/* Phase 2b: Pending device approvals + recent security events.
          These are only visible when isAdmin is true and only mount
          their internal RPCs once visible — no admin-only network
          traffic for non-admin users. */}
      <div className="card space-y-3">
        <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
          <TrendingUp size={15} className="text-lobster-teal" /> Lobster Score (Glicko-2)
        </h3>
        <p className="text-xs text-gray-500">
          Rebuilds shadow ratings from every known tournament (history file + DB) in chronological
          order. Re-run after registering a new historical player or completing a tournament.
        </p>
        <button
          onClick={handleRecomputeRatings}
          disabled={recomputing}
          className="bg-lobster-teal text-white text-sm font-semibold px-4 py-2 rounded-xl active:scale-95 transition-all disabled:opacity-60"
        >
          {recomputing ? 'Recomputing…' : 'Recompute ratings'}
        </button>
        {recomputeResult && recomputeResult.ok && (
          <p className="text-xs text-green-600">
            ✓ Updated {recomputeResult.playersUpdated} players from{' '}
            {recomputeResult.eventsProcessed} events.
            {recomputeResult.droppedMatches > 0 &&
              ` (${recomputeResult.droppedMatches} historical matches skipped — unmatched names)`}
          </p>
        )}
        {recomputeResult && !recomputeResult.ok && (
          <p className="text-xs text-red-600">✗ {recomputeResult.message}</p>
        )}
      </div>

      <AdminSecurityPanels />

      {/* Padel Tips */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
            <Lightbulb size={15} className="text-amber-500" /> Padel Tips
          </h3>
          <div className="flex items-center gap-2">
            {isCustom && (
              <button
                type="button"
                onClick={handleResetTips}
                className="flex items-center gap-1 text-[10px] text-gray-400 font-semibold"
              >
                <RotateCcw size={10} /> Reset to defaults
              </button>
            )}
            <button
              type="button"
              onClick={() => setTipsExpanded((e) => !e)}
              className="text-xs text-lobster-teal font-semibold"
            >
              {tipsExpanded ? 'Collapse' : `View all (${activeTips.length})`}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400">
          One tip shows per day on the home page.{' '}
          {isCustom ? 'Using custom tips.' : 'Using 50 default tips.'} Changes save automatically.
        </p>

        {/* Add new tip */}
        <div className="flex gap-2">
          <input
            className="input flex-1 text-xs"
            placeholder="Add a new tip..."
            value={newTip}
            onChange={(e) => setNewTip(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTip())}
          />
          <button
            type="button"
            onClick={handleAddTip}
            className="bg-lobster-teal text-white px-3 rounded-xl text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all"
          >
            <Plus size={14} /> Add
          </button>
        </div>

        {/* Tips list */}
        {tipsExpanded && (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {activeTips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2 bg-gray-50 rounded-xl px-3 py-2 group">
                <span className="text-[10px] text-gray-400 font-mono mt-0.5 flex-shrink-0 w-5">
                  {i + 1}
                </span>
                {editingTip?.index === i ? (
                  <div className="flex-1 flex gap-1">
                    <input
                      className="input flex-1 text-xs py-1"
                      value={editingTip.text}
                      onChange={(e) => setEditingTip((prev) => ({ ...prev, text: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="text-xs text-green-600 font-semibold px-2"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingTip(null)}
                      className="text-xs text-gray-400 font-semibold px-1"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <p
                      className="flex-1 text-xs text-gray-600 leading-relaxed cursor-pointer"
                      onClick={() => handleEditTip(i)}
                    >
                      {tip}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleDeleteTip(i)}
                      className="text-gray-300 hover:text-red-500 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save button */}
      <button
        type="submit"
        disabled={saving}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        <Save size={16} />
        {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Settings'}
      </button>
    </form>
  )
}
