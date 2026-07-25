// Shared active/inactive styling for segmented-control-style button groups
// (preset picker, lefty rule, rounds tab). Byte-identical to the classes each
// caller used before this was extracted.
export const segmentedButtonClass = (active: boolean): string =>
  `flex-1 py-2 text-sm rounded-xl font-semibold transition-all ${
    active ? 'bg-lob-teal text-white' : 'bg-gray-100 text-gray-600'
  }`
