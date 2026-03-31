import React, { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Lock } from 'lucide-react'

export default function AdminLogin({ onClose }) {
  const { settings, setIsAdmin } = useApp()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (pin === (settings?.adminPin || '1234')) {
      setIsAdmin(true)
      onClose?.()
    } else {
      setError('Incorrect PIN. Try again.')
      setPin('')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-lobster-teal rounded-full flex items-center justify-center">
            <Lock size={18} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800">Admin Access</h2>
            <p className="text-xs text-gray-500">Enter your PIN to continue</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            placeholder="Enter PIN"
            className="input text-center text-2xl tracking-widest"
            value={pin}
            onChange={e => { setPin(e.target.value); setError('') }}
            autoFocus
          />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">Unlock</button>
          </div>
        </form>
      </div>
    </div>
  )
}
