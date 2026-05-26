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
    <div className="-mx-4 px-4 py-2 bg-lob-cream border-b border-gray-100 sticky top-0 z-10 flex gap-2">
      {divisions.map((div) => (
        <button
          key={div}
          onClick={() => onChange(div)}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            value === div ? 'bg-lob-teal text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {DIVISION_LABELS[div]}
        </button>
      ))}
    </div>
  )
}
