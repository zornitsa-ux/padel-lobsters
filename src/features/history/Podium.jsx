import React from 'react'
import { smartSort } from './historicalStats'

export default function Podium({ players, rounds = [], rn = (n) => n, dn = (n) => n }) {
  const sorted =
    rounds.length > 0 ? smartSort(players, rounds) : [...players].sort((a, b) => b.total - a.total)
  const top3 = sorted.slice(0, 3)
  if (top3.length < 2) return null
  return (
    <div className="flex items-end justify-center gap-2 py-2">
      {/* 2nd */}
      <div className="flex flex-col items-center gap-1 flex-1">
        <span className="text-xl">🥈</span>
        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-600">
          {rn(top3[1]?.name || '')[0]}
        </div>
        <p className="text-sm font-semibold w-full text-center leading-tight px-1">
          {dn(rn(top3[1]?.name || ''))}
        </p>
        <div className="bg-gray-200 w-full h-10 rounded-t-xl flex items-center justify-center">
          <span className="text-xs font-bold text-gray-600">{top3[1]?.total}pts</span>
        </div>
      </div>
      {/* 1st */}
      <div className="flex flex-col items-center gap-1 flex-1">
        <span className="text-2xl">🥇</span>
        <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center font-bold text-white text-lg">
          {rn(top3[0]?.name || '')[0]}
        </div>
        <p className="text-base font-bold w-full text-center leading-tight px-1">
          {dn(rn(top3[0]?.name || ''))}
        </p>
        <div className="bg-yellow-400 w-full h-16 rounded-t-xl flex items-center justify-center">
          <span className="text-xs font-bold text-white">{top3[0]?.total}pts</span>
        </div>
      </div>
      {/* 3rd */}
      {top3[2] && (
        <div className="flex flex-col items-center gap-1 flex-1">
          <span className="text-xl">🥉</span>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white"
            style={{ background: '#CD7F32' }}
          >
            {rn(top3[2]?.name || '')[0]}
          </div>
          <p className="text-sm font-semibold w-full text-center leading-tight px-1">
            {dn(rn(top3[2]?.name || ''))}
          </p>
          <div
            className="w-full h-7 rounded-t-xl flex items-center justify-center"
            style={{ background: '#CD7F32' }}
          >
            <span className="text-xs font-bold text-white">{top3[2]?.total}pts</span>
          </div>
        </div>
      )}
    </div>
  )
}
