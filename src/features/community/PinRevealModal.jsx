import React from 'react'

export default function PinRevealModal({ pinReveal, onClose }) {
  if (!pinReveal) return null
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6 space-y-5 text-center shadow-xl">
        <div className="text-5xl">🦞</div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Welcome, {pinReveal.name}!</h2>
          <p className="text-sm text-gray-500 mt-1">Here's your personal access PIN:</p>
        </div>

        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl py-5 px-4">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-2">
            Your PIN
          </p>
          <p className="text-5xl font-bold text-amber-800 tracking-[0.35em]">{pinReveal.pin}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-left space-y-1.5">
          <p className="text-xs font-semibold text-gray-600">Save this PIN — you'll use it to:</p>
          <p className="text-xs text-gray-500">🦞 Register for events and check your stats</p>
          <p className="text-xs text-gray-500">📋 Confirm your identity in the app</p>
          <p className="text-xs text-gray-500">🔒 Keep your account secure</p>
        </div>
        <p className="text-[10px] text-gray-400">Ask the admin if you ever lose your PIN</p>

        <button onClick={onClose} className="btn-primary w-full">
          Got it, let's play! 🎾
        </button>
      </div>
    </div>
  )
}
