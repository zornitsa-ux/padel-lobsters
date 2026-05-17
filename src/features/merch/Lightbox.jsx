import React, { useState } from 'react'
import { X } from 'lucide-react'

// ── Image Lightbox ────────────────────────────────────────────────────────────
export default function Lightbox({ images, startIndex = 0, onClose }) {
  const [current, setCurrent] = useState(startIndex)
  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white"
      >
        <X size={20} />
      </button>

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
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${i === current ? 'border-white' : 'border-transparent opacity-50'}`}
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
