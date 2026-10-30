// A failed refetch keeps the last data; only a first load that failed has nothing to show.
export const loadFailed = ({ isError, data }: { isError: boolean; data: unknown }) =>
  isError && data === undefined
