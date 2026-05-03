import React, { useEffect, useState } from 'react'
import { X, MessageCircle, Users, Clock } from 'lucide-react'
import { useApp } from '../context/AppContext'
import {
  buildTransferMessage, isE164, shareToDirectChat, shareToLobstersGroup,
} from '../lib/whatsapp'

// Confirmation modal that comes up after a transfer offer is sent.
// Shows two share actions:
//   - Direct WhatsApp message to recipient (only if their phone is E.164)
//   - Post in Padel Lobsters group (always available; copies message + opens
//     the group invite link)
// Both share actions can be re-used later from the persistent pending banner
// on the registration card, so this component takes only the transfer +
// recipient and never assumes "first time after creation".
//
// Props:
//   transferId: uuid of the registration_transfers row
//   toPlayer:   the recipient player object (has .id, .name; we re-fetch
//               .phone via the privacy-respecting RPC)
//   onClose():  dismiss
//   onCancel(): user explicitly cancels the offer (calls cancelTransfer)
export default function TransferPendingModal({ transferId, toPlayer, onClose, onCancel }) {
  const { getTransferRecipientContact, cancelTransfer } = useApp()

  const [phone, setPhone]     = useState(null) // null = loading, '' = no phone
  const [busyAction, setBusyAction] = useState(null) // 'whatsapp' | 'group' | 'cancel' | null
  const [groupNote, setGroupNote] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      const r = await getTransferRecipientContact(transferId)
      if (!active) return
      if (r.ok) setPhone(r.phone || '')
      else      setPhone('') // any error → fall back to group share
    })()
    return () => { active = false }
  }, [transferId])

  const message = buildTransferMessage(toPlayer?.name, transferId)
  const phoneIsValid = phone !== null && isE164(phone)

  const handleDirect = () => {
    if (busyAction) return
    setBusyAction('whatsapp')
    const ok = shareToDirectChat(phone, message)
    setTimeout(() => setBusyAction(null), 600)
    if (!ok) {
      // Phone unexpectedly invalid — fall back automatically.
      handleGroup()
    }
  }

  const handleGroup = async () => {
    if (busyAction) return
    setBusyAction('group')
    await shareToLobstersGroup(message)
    setGroupNote(true)
    setTimeout(() => setBusyAction(null), 600)
  }

  const handleCancelOffer = async () => {
    if (busyAction) return
    if (!confirm('Cancel the transfer offer? Your spot will stay registered to you.')) return
    setBusyAction('cancel')
    const r = await cancelTransfer(transferId)
    setBusyAction(null)
    if (r.ok) {
      onCancel?.()
      onClose?.()
    } else {
      alert('Could not cancel the offer. Please try again.')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center">
      <div className="bg-white rounded-t-3xl w-full max-w-md p-5 space-y-4 max-h-[90vh] flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
            <h3 className="font-bold text-gray-800">Awaiting {(toPlayer?.name || 'their').split(/\s+/)[0]}'s response</h3>
          </div>
          <button onClick={onClose}>
            <X size={22} className="text-gray-400" />
          </button>
        </div>

        <p className="text-xs text-gray-500 leading-relaxed">
          Your spot is held in <strong>pending transfer</strong> until {(toPlayer?.name || 'they').split(/\s+/)[0]} accepts.
          Send the link via WhatsApp so they know to open it.
        </p>

        <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-gray-700 leading-relaxed">
          <p className="font-semibold text-gray-500 text-[10px] uppercase tracking-wide mb-1">Pre-filled message</p>
          <p className="whitespace-pre-line">{message}</p>
        </div>

        {phoneIsValid && (
          <button
            onClick={handleDirect}
            disabled={!!busyAction}
            className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-semibold py-3 rounded-xl active:scale-[0.98] disabled:opacity-50 transition-all"
          >
            <MessageCircle size={16} />
            {busyAction === 'whatsapp' ? 'Opening WhatsApp…' : `Contact ${(toPlayer?.name || '').split(/\s+/)[0]} on WhatsApp`}
          </button>
        )}

        <button
          onClick={handleGroup}
          disabled={!!busyAction}
          className="w-full flex items-center justify-center gap-2 border border-green-600 text-green-700 font-semibold py-3 rounded-xl active:scale-[0.98] disabled:opacity-50 transition-all"
        >
          <Users size={16} />
          {busyAction === 'group' ? 'Copying message…' : 'Post in Lobsters WhatsApp group'}
        </button>

        {groupNote && (
          <p className="text-[11px] text-gray-500 text-center">
            Message copied to your clipboard — paste it in the group chat.
          </p>
        )}

        {phone === '' && (
          <p className="text-[11px] text-gray-400 text-center">
            No WhatsApp number on file for {(toPlayer?.name || 'this player').split(/\s+/)[0]} — use the group instead.
          </p>
        )}

        <div className="border-t border-gray-100 pt-3 flex items-center justify-between text-xs">
          <span className="text-gray-400 inline-flex items-center gap-1"><Clock size={12} /> No expiry — closes when the event starts</span>
          <button
            onClick={handleCancelOffer}
            disabled={!!busyAction}
            className="text-red-600 font-semibold disabled:opacity-50"
          >
            {busyAction === 'cancel' ? 'Cancelling…' : 'Cancel offer'}
          </button>
        </div>
      </div>
    </div>
  )
}
