import React, { useState } from 'react'
import { X } from 'lucide-react'
import { IconButton } from '../../components/ui/IconButton'
import { ImageTile } from '../../components/ui/OptionTile'

// ── Image Lightbox ────────────────────────────────────────────────────────────
export type LightboxState = { images: string[]; index: number }

type LightboxProps = {
  images: string[]
  startIndex?: number
  onClose: () => void
}

export default function Lightbox({ images, startIndex = 0, onClose }: LightboxProps) {
  const [current, setCurrent] = useState(startIndex)
  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center"
      onClick={onClose}
    >
      <IconButton
        onClick={onClose}
        aria-label="Close"
        variant="on-dark"
        className="absolute top-4 right-4"
      >
        <X />
      </IconButton>

      {/* Main image */}
      <img
        src={images[current]}
        alt=""
        className="max-w-full max-h-[80vh] object-contain rounded-xl"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Thumbnails if multiple */}
      {images.length > 1 && (
        <div className="flex gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
          {images.map((url, i) => (
            <ImageTile
              key={i}
              src={url}
              selected={i === current}
              onClick={() => setCurrent(i)}
              aria-label={`Photo ${i + 1} of ${images.length}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
