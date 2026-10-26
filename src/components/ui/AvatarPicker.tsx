import { useRef, type ChangeEvent } from 'react'
import { Camera, User } from 'lucide-react'
import { IconButton } from './IconButton'

interface AvatarPickerProps {
  /** Photo URL to show; `null` shows the empty placeholder. */
  preview: string | null
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}

export function AvatarPicker({ preview, onChange }: AvatarPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const action = preview ? 'change' : 'add'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        {preview ? (
          <img
            src={preview}
            alt="Preview"
            className="w-20 h-20 rounded-full object-cover border-2 border-lob-teal"
          />
        ) : (
          <div className="w-20 h-20 bg-lob-line rounded-full flex items-center justify-center text-lob-muted-light border-2 border-dashed border-lob-line-strong">
            <User size={28} />
          </div>
        )}
        <IconButton
          onClick={() => inputRef.current?.click()}
          aria-label={`${preview ? 'Change' : 'Add'} photo`}
          variant="accent"
          size="sm"
          className="absolute -bottom-1 -right-1"
        >
          <Camera />
        </IconButton>
      </div>
      <p className="text-xs text-lob-muted-light">Tap camera icon to {action} photo</p>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onChange} />
    </div>
  )
}
