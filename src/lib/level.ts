// A Playtomic level of 0 means none was given (signup revamp D-5, D-14).
export const knownLevel = ({ level }: { level: number | null | undefined }): number | null =>
  level != null && level > 0 ? level : null

export const hasLevel = ({ level }: { level: number | null | undefined }): boolean =>
  knownLevel({ level }) != null

// D-15: a player with no level counts as the lowest walls start, the same on
// every screen and in the matcher's prior.
export const NO_LEVEL_START = 1

/** The level, or NO_LEVEL_START for a player with none. */
export const levelOrNoLevelStart = ({ level }: { level: number | null | undefined }): number =>
  knownLevel({ level }) ?? NO_LEVEL_START

/** "Lv 2.5", or undefined for a player with no level, who shows none (D-14). */
export const levelText = ({
  level,
  prefix = 'Lv',
}: {
  level: number | null | undefined
  prefix?: string
}): string | undefined => {
  const value = knownLevel({ level })
  return value == null ? undefined : `${prefix} ${value.toFixed(1)}`
}
