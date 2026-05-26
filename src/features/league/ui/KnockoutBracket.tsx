import { useRef, useLayoutEffect, useState } from 'react'
import { BracketMatchSlot } from './BracketMatchSlot'
import type { LeagueMatch, LeagueTeam } from '../domain/types'

interface KnockoutBracketProps {
  semi1: LeagueMatch | undefined
  semi2: LeagueMatch | undefined
  final: LeagueMatch | undefined
  teamById: Record<string, LeagueTeam>
  onTeamClick?: (team: LeagueTeam) => void
}

interface ConnectorGeo {
  s1y: number // semi1 card center Y, relative to container top
  s2y: number // semi2 card center Y, relative to container top
  semisRightX: number // right edge of semis column
  finalLeftX: number // left edge of final card
  h: number // container height
}

const CORNER_RADIUS = 8

function connectorPaths(geo: ConnectorGeo): { d1: string; d2: string } {
  const { s1y, s2y, semisRightX, finalLeftX } = geo
  const r = CORNER_RADIUS
  const trunkX = semisRightX + (finalLeftX - semisRightX) * 0.45
  const midY = (s1y + s2y) / 2

  // Clamp radius so arc never overshoots the midpoint
  const r1 = Math.min(r, Math.abs(midY - s1y) - 1)
  const r2 = Math.min(r, Math.abs(midY - s2y) - 1)

  // semi1 arm: horizontal from semi1 center → curve downward → vertical to midY → horizontal to final
  const d1 = [
    `M ${semisRightX} ${s1y}`,
    `H ${trunkX - r}`,
    `Q ${trunkX} ${s1y} ${trunkX} ${s1y + r1}`,
    `V ${midY}`,
    `H ${finalLeftX}`,
  ].join(' ')

  // semi2 arm: horizontal from semi2 center → curve upward → vertical to midY (joins d1 at trunk)
  const d2 = [
    `M ${semisRightX} ${s2y}`,
    `H ${trunkX - r}`,
    `Q ${trunkX} ${s2y} ${trunkX} ${s2y - r2}`,
    `V ${midY}`,
  ].join(' ')

  return { d1, d2 }
}

export function KnockoutBracket({
  semi1,
  semi2,
  final,
  teamById,
  onTeamClick,
}: KnockoutBracketProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const semi1Ref = useRef<HTMLDivElement>(null)
  const semi2Ref = useRef<HTMLDivElement>(null)
  const finalRef = useRef<HTMLDivElement>(null)
  const [geo, setGeo] = useState<ConnectorGeo | null>(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const measure = () => {
      const s1El = semi1Ref.current
      const s2El = semi2Ref.current
      const finEl = finalRef.current
      if (!s1El || !s2El || !finEl) return

      const cRect = container.getBoundingClientRect()
      const s1Rect = s1El.getBoundingClientRect()
      const s2Rect = s2El.getBoundingClientRect()
      const finRect = finEl.getBoundingClientRect()

      setGeo({
        s1y: s1Rect.top + s1Rect.height / 2 - cRect.top,
        s2y: s2Rect.top + s2Rect.height / 2 - cRect.top,
        semisRightX: s1Rect.right - cRect.left,
        finalLeftX: finRect.left - cRect.left,
        h: cRect.height,
      })
    }

    const observer = new ResizeObserver(measure)
    observer.observe(container)
    measure()

    return () => observer.disconnect()
  }, [])

  function getTeam(id: string | null | undefined): LeagueTeam | undefined {
    return id ? teamById[id] : undefined
  }

  const finalTeam1 = final ? getTeam(final.team1_id) : getTeam(semi1?.winner_id)
  const finalTeam2 = final ? getTeam(final.team2_id) : getTeam(semi2?.winner_id)

  const noMatches = !semi1 && !semi2 && !final
  if (noMatches) {
    return <p className="text-sm text-lob-muted py-4">Bracket not yet generated.</p>
  }

  const paths = geo ? connectorPaths(geo) : null

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max mb-2">
        <div className="w-36 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">
          Semi-finals
        </div>
        <div className="w-10" />
        <div className="w-36 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-center">
          Final
        </div>
      </div>

      <div className="relative flex items-stretch min-w-max" ref={containerRef}>
        {/* Semi-finals */}
        <div className="flex flex-col gap-6">
          <div ref={semi1Ref}>
            <BracketMatchSlot
              match={semi1}
              team1={getTeam(semi1?.team1_id)}
              team2={getTeam(semi1?.team2_id)}
              onTeamClick={onTeamClick}
            />
          </div>
          <div ref={semi2Ref}>
            <BracketMatchSlot
              match={semi2}
              team1={getTeam(semi2?.team1_id)}
              team2={getTeam(semi2?.team2_id)}
              onTeamClick={onTeamClick}
            />
          </div>
        </div>

        {/* Connector space — SVG draws here */}
        <div className="w-10" aria-hidden="true" />

        {/* Final */}
        <div className="flex items-center" ref={finalRef}>
          <BracketMatchSlot
            match={final}
            team1={finalTeam1}
            team2={finalTeam2}
            onTeamClick={onTeamClick}
          />
        </div>

        {/* SVG connector lines */}
        {paths && geo && (
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ width: '100%', height: geo.h, overflow: 'visible' }}
            aria-hidden="true"
          >
            <path
              d={paths.d1}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={paths.d2}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    </div>
  )
}
