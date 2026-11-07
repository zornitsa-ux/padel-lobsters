import { Navigate, useLocation } from 'react-router-dom'
import { withShareTags } from './shareTags'

/** A redirect that keeps the share tags (and drops the rest of the query, e.g. `?signup`). */
export function NavigateWithShareTags({ to }: { to: string }) {
  const { search } = useLocation()
  return <Navigate to={withShareTags({ path: to, search })} replace />
}
