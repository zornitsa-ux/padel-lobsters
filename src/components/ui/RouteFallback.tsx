import { Spinner } from './Spinner'

// Shown while a lazily-loaded route chunk is in flight, or while the route's
// own data is still resolving. Kept deliberately minimal — the app shell
// (header/nav) is already painted around it, so this only fills the content
// area.
export function RouteFallback() {
  return <Spinner className="py-24" />
}
