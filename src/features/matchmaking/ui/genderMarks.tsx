import type { PlayerGender } from '../domain/types'
import type { CourtChip } from './genderCopy'
import { TextButton } from '../../../components/ui/TextButton'
import { Badge, type BadgeTone } from '../../../components/ui/Badge'

const MARKS = {
  female: { letter: 'W', label: 'Woman', className: 'bg-pink-100 text-pink-700' },
  male: { letter: 'M', label: 'Man', className: 'bg-blue-100 text-blue-700' },
} as const

const BADGE = 'inline-flex items-center justify-center rounded-full text-2xs font-bold w-4 h-4'

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
  neutral: 'neutral',
  uneven: 'warning',
} as const satisfies Record<string, BadgeTone>

export function CourtGenderChip({
  chip,
  onFix,
  fixLabel,
}: {
  chip: CourtChip | null
  onFix?: () => void
  fixLabel?: string
}) {
  if (!chip) return null
  return (
    <>
      <Badge tone={CHIP_TONES[chip.tone]} label={chip.text} title={chip.title} />
      {onFix && (
        <TextButton tone="warning" hitArea onClick={onFix} aria-label={fixLabel}>
          Fix
        </TextButton>
      )}
    </>
  )
}
