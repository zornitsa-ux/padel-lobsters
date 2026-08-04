// Immutable array reordering helpers shared by any admin editor that needs
// move-up/move-down controls (Lobster Way categories and questions today).
export function moveItem(array, index, direction) {
  const target = index + direction
  if (target < 0 || target >= array.length) return array
  const next = array.slice()
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export function removeAt(array, index) {
  return array.filter((_, i) => i !== index)
}

export function replaceAt(array, index, value) {
  return array.map((item, i) => (i === index ? value : item))
}
