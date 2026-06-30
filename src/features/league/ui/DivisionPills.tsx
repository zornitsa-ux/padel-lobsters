import type { Division } from '../domain/types'

const DIVISION_LABELS: Record<Division, string> = {
  mens: "Men's",
  womens: "Women's",
}

export function DivisionPills({
  divisions,
  value,
  onChange,
}: {
  divisions: Division[]
  value: Division
  onChange: (d: Division) => void
}) {
  if (divisions.length <= 1) return null
  return (
    <>
      {divisions.map((div) => (
        <button
          key={div}
          onClick={() => onChange(div)}
          className={`px-3.5 py-1.5 text-sm font-semibold rounded-full transition-colors whitespace-nowrap ${
            value === div ? 'bg-lob-coral text-white shadow-sm' : 'text-lob-teal hover:bg-white/60'
          }`}
        >
          {DIVISION_LABELS[div]}
        </button>
      ))}
    </>
  )
}
