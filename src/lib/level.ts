// A Playtomic level of 0 means none was given (signup revamp D-5, D-14).
export const hasLevel = ({ level }: { level: number | null | undefined }): boolean =>
  level != null && level > 0

// D-15: a player with no level counts as the lowest walls start, the same on
// every screen and in the matcher's prior.
export const NO_LEVEL_START = 1

/** "Lv 2.5", or undefined for a player with no level, who shows none (D-14). */
export const levelText = ({
  level,
  prefix = 'Lv',
}: {
  level: number | null | undefined
  prefix?: string
}): string | undefined =>
  level != null && hasLevel({ level }) ? `${prefix} ${level.toFixed(1)}` : undefined
