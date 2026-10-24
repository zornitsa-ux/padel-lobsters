// RPCs declared `returns table` come back as an array; take the one row.
export const firstRow = <T>(data: T[] | T | null): T | null =>
  (Array.isArray(data) ? data[0] : data) ?? null
