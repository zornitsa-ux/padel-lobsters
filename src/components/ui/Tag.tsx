export interface TagProps {
  /** Names a thing: "Court 2", "Round 3", "M", "Mixed". A state (Paid, Live, Confirmed) is a `Badge`. */
  label: string
}

/** An identity label. Square-cornered, so it doesn't read as a state `Badge` pill. */
export function Tag({ label }: TagProps) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center rounded-md bg-lob-cream px-2 py-0.5 text-xs font-semibold text-lob-teal">
      <span className="truncate">{label}</span>
    </span>
  )
}
