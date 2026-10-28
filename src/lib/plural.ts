/** "1 rating", "3 ratings". `many` defaults to `one` plus "s". */
export const plural = ({
  count,
  one,
  many = `${one}s`,
}: {
  count: number
  one: string
  many?: string
}) => `${count} ${count === 1 ? one : many}`
