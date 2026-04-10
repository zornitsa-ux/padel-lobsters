import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'

export const COUNTRIES = [
  ['', 'Select country…'],
  ['AR','Argentina'],['AU','Australia'],['AT','Austria'],['BE','Belgium'],
  ['BA','Bosnia and Herzegovina'],['BR','Brazil'],['BG','Bulgaria'],
  ['CA','Canada'],['CL','Chile'],['CN','China'],
  ['CO','Colombia'],['HR','Croatia'],['CY','Cyprus'],['CZ','Czech Republic'],
  ['DK','Denmark'],['EG','Egypt'],['EE','Estonia'],['FI','Finland'],
  ['FR','France'],['DE','Germany'],['GR','Greece'],['HU','Hungary'],
  ['IN','India'],['ID','Indonesia'],['IE','Ireland'],['IL','Israel'],
  ['IT','Italy'],['JP','Japan'],['LV','Latvia'],['LT','Lithuania'],
  ['LU','Luxembourg'],['MK','North Macedonia'],['MY','Malaysia'],
  ['MT','Malta'],['MX','Mexico'],['MD','Moldova'],['MA','Morocco'],
  ['NL','Netherlands'],['NZ','New Zealand'],['NG','Nigeria'],['NO','Norway'],
  ['PK','Pakistan'],['PE','Peru'],['PH','Philippines'],['PL','Poland'],
  ['PT','Portugal'],['RO','Romania'],['RS','Serbia'],['SK','Slovakia'],
  ['SI','Slovenia'],['SG','Singapore'],['ZA','South Africa'],
  ['KR','South Korea'],['ES','Spain'],['SE','Sweden'],['CH','Switzerland'],
  ['TR','Turkey'],['UA','Ukraine'],
  ['AE','United Arab Emirates'],['GB','United Kingdom'],['US','United States'],
  ['UY','Uruguay'],['VE','Venezuela'],
]

export const countryFlag = (code) => {
  if (!code || code.length !== 2) return ''
  return code.toUpperCase().split('').map(c =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  ).join('')
}

export function FlagImg({ code, className = '' }) {
  if (!code || code.length !== 2) return null
  return (
    <img
      src={`https://flagcdn.com/20x15/${code.toLowerCase()}.png`}
      width="20" height="15"
      alt={code}
      className={`inline-block flex-shrink-0 ${className}`}
    />
  )
}

export default function CountryPicker({ value, onChange }) {
  const [query, setQuery]     = useState('')
  const [open, setOpen]       = useState(false)
  const containerRef          = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false); setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectedLabel = COUNTRIES.find(([code]) => code === value)?.[1] || ''
  const filtered = COUNTRIES.slice(1).filter(([code, label]) =>
    label.toLowerCase().includes(query.toLowerCase()) ||
    code.toLowerCase().includes(query.toLowerCase())
  )

  const select = (code) => {
    onChange(code); setOpen(false); setQuery('')
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className="input flex items-center gap-2 cursor-text"
        onClick={() => { setOpen(true); setQuery('') }}
      >
        {value && !open && <FlagImg code={value} />}
        <input
          type="text"
          className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400 min-w-0"
          placeholder={open ? 'Type to search…' : (selectedLabel || 'Select country…')}
          value={open ? query : (selectedLabel || '')}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
        />
        <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
      </div>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-xs text-gray-400 px-3 py-3 text-center">No countries found</p>
          )}
          {filtered.map(([code, label]) => (
            <button
              key={code}
              type="button"
              onMouseDown={() => select(code)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-lobster-cream ${value === code ? 'bg-lobster-cream font-semibold text-lobster-teal' : 'text-gray-700'}`}
            >
              <FlagImg code={code} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
