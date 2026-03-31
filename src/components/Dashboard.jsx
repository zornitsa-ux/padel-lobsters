import React from 'react'
import { useApp } from '../context/AppContext'
import { Trophy, Users, CreditCard, Calendar, ChevronRight, Clock, AlertCircle } from 'lucide-react'

export default function Dashboard({ onNavigate }) {
  const { tournaments, players, registrations, getTournamentRegistrations } = useApp()

  // Next upcoming tournament
  const upcoming = tournaments
    .filter(t => t.status === 'upcoming' || t.status === 'active')
    .sort((a, b) => (a.date || '') < (b.date || '') ? -1 : 1)[0]

  const regs = upcoming ? getTournamentRegistrations(upcoming.id) : []
  const registered = regs.filter(r => r.status === 'registered')
  const waitlisted = regs.filter(r => r.status === 'waitlist')
  const paid       = regs.filter(r => r.paymentStatus === 'paid')
  const unpaid     = regs.filter(r => r.status === 'registered' && r.paymentStatus !== 'paid')

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  return (
    <div className="space-y-5">
      {/* Next event hero card */}
      {upcoming ? (
        <div className="bg-lobster-teal rounded-2xl p-5 text-white">
          <p className="text-lobster-teal-light text-xs font-semibold uppercase tracking-wide mb-1">
            Next Event
          </p>
          <h2 className="text-xl font-bold mb-1">{upcoming.name}</h2>
          <div className="flex items-center gap-1.5 text-sm opacity-90 mb-4">
            <Calendar size={14} />
            {formatDate(upcoming.date)}
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <Stat label="Players" value={`${registered.length}/${upcoming.maxPlayers || '?'}`} />
            <Stat label="Waitlist" value={waitlisted.length} warn={waitlisted.length > 0} />
            <Stat label="Courts" value={(upcoming.courts || []).filter(c => c.booked).length + '/' + (upcoming.courts || []).length} />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onNavigate('registration', upcoming)}
              className="flex-1 bg-white text-lobster-teal font-semibold py-2 rounded-xl text-sm active:scale-95 transition-all"
            >
              Registrations
            </button>
            <button
              onClick={() => onNavigate('payments', upcoming)}
              className="flex-1 bg-lobster-orange text-white font-semibold py-2 rounded-xl text-sm active:scale-95 transition-all"
            >
              Payments
            </button>
            <button
              onClick={() => onNavigate('schedule', upcoming)}
              className="flex-1 bg-white/20 text-white font-semibold py-2 rounded-xl text-sm active:scale-95 transition-all"
            >
              Schedule
            </button>
          </div>
        </div>
      ) : (
        <div className="card flex flex-col items-center py-10 text-center gap-3">
          <Trophy size={40} className="text-lobster-teal opacity-30" />
          <p className="font-semibold text-gray-500">No upcoming events</p>
          <button onClick={() => onNavigate('tournament')} className="btn-primary text-sm py-2 px-4">
            Create an Event
          </button>
        </div>
      )}

      {/* Alerts */}
      {unpaid.length > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            {unpaid.length} player{unpaid.length > 1 ? 's' : ''} haven't paid yet
          </p>
          <button onClick={() => onNavigate('payments', upcoming)} className="ml-auto text-xs text-red-600 font-semibold">
            View →
          </button>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <QuickCard
          icon={<Users size={20} className="text-lobster-teal" />}
          label="Total Players"
          value={players.length}
          onClick={() => onNavigate('players')}
        />
        <QuickCard
          icon={<Trophy size={20} className="text-lobster-orange" />}
          label="Events"
          value={tournaments.length}
          onClick={() => onNavigate('tournament')}
        />
      </div>

      {/* Recent events */}
      {tournaments.length > 0 && (
        <section>
          <h3 className="font-bold text-gray-700 mb-3">All Events</h3>
          <div className="space-y-2">
            {tournaments.slice(0, 5).map(t => {
              const tRegs = getTournamentRegistrations(t.id)
              const tPaid = tRegs.filter(r => r.paymentStatus === 'paid').length
              return (
                <button
                  key={t.id}
                  onClick={() => onNavigate('registration', t)}
                  className="card w-full flex items-center gap-3 active:scale-[0.98] transition-all"
                >
                  <div className="w-10 h-10 bg-lobster-cream rounded-xl flex items-center justify-center flex-shrink-0">
                    <Trophy size={18} className="text-lobster-teal" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-semibold text-sm truncate">{t.name}</p>
                    <p className="text-xs text-gray-500">{formatDate(t.date)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      t.status === 'completed' ? 'bg-gray-100 text-gray-500'
                      : t.status === 'active'   ? 'bg-green-100 text-green-700'
                      : 'bg-blue-100 text-blue-700'
                    }`}>
                      {t.status}
                    </span>
                    <p className="text-xs text-gray-400 mt-0.5">{tPaid}/{tRegs.filter(r=>r.status==='registered').length} paid</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                </button>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

function Stat({ label, value, warn }) {
  return (
    <div className="bg-white/15 rounded-xl p-2.5 text-center">
      <p className={`text-xl font-bold ${warn ? 'text-lobster-gold' : 'text-white'}`}>{value}</p>
      <p className="text-[10px] text-white/70 font-medium">{label}</p>
    </div>
  )
}

function QuickCard({ icon, label, value, onClick }) {
  return (
    <button onClick={onClick} className="card flex items-center gap-3 active:scale-[0.98] transition-all w-full">
      <div className="w-10 h-10 bg-lobster-cream rounded-xl flex items-center justify-center">
        {icon}
      </div>
      <div className="text-left">
        <p className="text-2xl font-bold text-gray-800">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </button>
  )
}
