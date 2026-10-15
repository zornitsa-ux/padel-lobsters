import type { PlayerGender } from '../domain/types'
import type { CourtChip } from './genderCopy'

const MARKS = {
  female: { letter: 'W', label: 'Woman', className: 'bg-pink-100 text-pink-700' },
  male: { letter: 'M', label: 'Man', className: 'bg-blue-100 text-blue-700' },
} as const

const BADGE = 'inline-flex items-center justify-center rounded-full text-[10px] font-bold w-4 h-4'

export function GenderMark({ gender }: { gender: PlayerGender }) {
  if (gender === 'unknown') return null
  const { letter, label, className } = MARKS[gender]
  return (
    <span title={label} aria-label={label} role="img" className={`${BADGE} ${className}`}>
      {letter}
    </span>
  )
}

export function GenderLegendEntries() {
  return (
    <>
      <span className="flex items-center gap-1">
        <GenderMark gender="female" /> Woman
      </span>
      <span className="flex items-center gap-1">
        <GenderMark gender="male" /> Man
      </span>
    </>
  )
}

const CHIP_TONES = {
  neutral: 'bg-gray-100 text-lob-muted',
  uneven: 'bg-amber-50 text-amber-700',
} as const

export function CourtGenderChip({ chip }: { chip: CourtChip | null }) {
  if (!chip) return null
  return (
    <span
      title={chip.title}
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${CHIP_TONES[chip.tone]}`}
    >
      {chip.text}
    </span>
  )
}
