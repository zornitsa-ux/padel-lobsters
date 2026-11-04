import { medalFor } from './RankMarker'

export interface PodiumPlace {
  /** The name shown under the disc; its first letter goes on the disc. */
  name: string
  points: number
}

interface PodiumProps {
  /** First, second and (optionally) third, in that order. */
  places: readonly PodiumPlace[]
}

const STEPS = {
  1: { fill: 'bg-lob-gold text-white', disc: 'w-12 h-12 text-lg', bar: 'h-16', order: 'order-2' },
  2: {
    fill: 'bg-lob-silver-soft text-lob-slate',
    disc: 'w-10 h-10',
    bar: 'h-10',
    order: 'order-1',
  },
  3: { fill: 'bg-lob-bronze text-white', disc: 'w-10 h-10', bar: 'h-7', order: 'order-3' },
} as const

type Rank = keyof typeof STEPS

function Step({ place, rank }: { place: PodiumPlace; rank: Rank }) {
  const step = STEPS[rank]
  return (
    <li className={`flex flex-col items-center gap-1 flex-1 min-w-0 ${step.order}`}>
      <span aria-hidden="true" className={rank === 1 ? 'text-2xl' : 'text-xl'}>
        {medalFor({ rank })}
      </span>
      <span
        aria-hidden="true"
        className={`rounded-full flex items-center justify-center font-bold ${step.disc} ${step.fill}`}
      >
        {place.name[0]}
      </span>
      <p
        className={`text-sm w-full text-center leading-tight px-1 text-lob-dark ${rank === 1 ? 'font-bold' : 'font-semibold'}`}
      >
        <span className="sr-only">{`Place ${rank}: `}</span>
        {place.name}
      </p>
      <span
        className={`w-full rounded-t-xl flex items-center justify-center text-xs font-bold ${step.bar} ${step.fill}`}
      >
        {place.points}pts
      </span>
    </li>
  )
}

/** The top two or three as podium steps in medal colours; read first to third, drawn second, first, third. */
export function Podium({ places }: PodiumProps) {
  const [first, second, third] = places
  if (!first || !second) return null
  return (
    <ol className="flex items-end justify-center gap-2">
      <Step place={first} rank={1} />
      <Step place={second} rank={2} />
      {third && <Step place={third} rank={3} />}
    </ol>
  )
}
