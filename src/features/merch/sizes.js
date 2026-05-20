export const SIZES_APPAREL = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
export const SIZES_SOCKS = ['S (35-38)', 'M (39-42)', 'L (43-46)']
export const SIZE_ORDER = ['XS', 'S', 'S (35-38)', 'M', 'M (39-42)', 'L', 'L (43-46)', 'XL', 'XXL']
export const sizeRank = (s) => {
  const i = SIZE_ORDER.indexOf(s)
  return i >= 0 ? i : 999
}
