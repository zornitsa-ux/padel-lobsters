import { useCallback, useRef, type InputHTMLAttributes, type Ref } from 'react'
import { Search, X } from 'lucide-react'
import { IconButton } from './IconButton'

type NativeProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'className' | 'aria-label'
>

interface SearchInputProps extends NativeProps {
  value: string
  onChange: (value: string) => void
  /** Names the field for screen readers. Leave out only when a `<label>` points at it. */
  label?: string
  inputRef?: Ref<HTMLInputElement>
}

/** A search field: icon, input, and a clear button once there's text. The field only; no suggestion list. */
export function SearchInput({ value, onChange, label, inputRef, ...rest }: SearchInputProps) {
  const ownRef = useRef<HTMLInputElement | null>(null)
  const setRefs = useCallback(
    (el: HTMLInputElement | null) => {
      ownRef.current = el
      if (typeof inputRef === 'function') inputRef(el)
      else if (inputRef) (inputRef as { current: HTMLInputElement | null }).current = el
    },
    [inputRef],
  )
  const canClear = Boolean(value) && !rest.disabled && !rest.readOnly
  const clear = () => {
    onChange('')
    ownRef.current?.focus()
  }

  return (
    <div className="relative">
      <Search
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lob-muted-light"
      />
      <input
        {...rest}
        ref={setRefs}
        type="text"
        aria-label={label}
        className="input pl-9 pr-10"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {canClear && (
        <span className="absolute right-1 top-1/2 -translate-y-1/2">
          <IconButton variant="ghost" size="sm" aria-label="Clear search" onClick={clear}>
            <X />
          </IconButton>
        </span>
      )}
    </div>
  )
}
