import { useMemo } from 'react'

// Dependency-free CSS confetti. Renders a fixed-position overlay of falling
// coloured pieces; mount it briefly (the caller unmounts after ~3s). Each
// piece gets a randomised column, delay, duration, colour and size so the
// burst looks organic without any physics library.
const COLORS = ['#E8A030', '#D94F2B', '#3D7A8A', '#34d399', '#f472b6', '#facc15']

export default function Confetti({ pieces = 80 }: { pieces?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => {
        const left = Math.random() * 100
        const delay = Math.random() * 0.6
        const duration = 2.4 + Math.random() * 1.6
        const size = 6 + Math.random() * 8
        const color = COLORS[i % COLORS.length]
        const rounded = Math.random() > 0.5
        return { left, delay, duration, size, color, rounded, key: i }
      }),
    [pieces],
  )

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {bits.map((b) => (
        <span
          key={b.key}
          className="absolute top-0 animate-confetti-fall"
          style={{
            left: `${b.left}%`,
            width: `${b.size}px`,
            height: `${b.size * 1.4}px`,
            backgroundColor: b.color,
            borderRadius: b.rounded ? '9999px' : '2px',
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.duration}s`,
          }}
        />
      ))}
    </div>
  )
}
