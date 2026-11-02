import { LABEL_SHELL } from './labelShell'

export interface TagProps {
  /** Names a thing: "Court 2", "Round 3", "M", "Mixed". A state (Paid, Live, Confirmed) is a `Badge`. */
  label: string
}

/**
 * An identity label. Square-cornered, so it doesn't read as a state `Badge` pill. It truncates in a
 * narrow row, with the full label as its tooltip.
 */
export function Tag({ label }: TagProps) {
  return (
    <span title={label} className={`${LABEL_SHELL} rounded-md bg-lob-cream text-lob-teal`}>
      <span className="truncate">{label}</span>
    </span>
  )
}
