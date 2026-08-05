// Immutable array reordering helpers shared by any admin editor that needs
// move-up/move-down controls (Lobster Way categories and questions today).
export function moveItem<T>(array: T[], index: number, direction: number): T[] {
  const target = index + direction
  if (target < 0 || target >= array.length) return array
  const next = array.slice()
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export function removeAt<T>(array: T[], index: number): T[] {
  return array.filter((_, i) => i !== index)
}

export function replaceAt<T>(array: T[], index: number, value: T): T[] {
  return array.map((item, i) => (i === index ? value : item))
}
