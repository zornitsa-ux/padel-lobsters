import { useLocation } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { levellingPath } from './levellingRoutes'

/**
 * Stands in for Accept on a transfer or team invite while the player needs levelling.
 * The offer stays open; the flow returns here.
 */
export default function SetLevelAction({ fullWidth = false }: { fullWidth?: boolean }) {
  const { pathname, search } = useLocation()
  return (
    <Button to={levellingPath({ from: pathname + search })} fullWidth={fullWidth}>
      Set your level to accept
    </Button>
  )
}
