import { useLocation } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { TextButton } from '../../components/ui/TextButton'
import { levellingPath } from './levellingRoutes'

interface LevellingPromptProps {
  title: string
  body: string
  action: string
  note: string
  /** Home cards carry an accent bar. */
  accent: boolean
  /** Adds "Not now" beside the note. */
  onDismiss?: () => void
  testId: string
}

/** A card leading into the levelling flow, which returns here when done or closed. */
export default function LevellingPrompt({
  title,
  body,
  action,
  note,
  accent,
  onDismiss,
  testId,
}: LevellingPromptProps) {
  const { pathname, search } = useLocation()
  const to = levellingPath({ from: pathname + search })
  return (
    <div
      className={`card space-y-3 ${accent ? 'border-l-4 border-lob-teal' : ''}`.trim()}
      data-testid={testId}
    >
      <div className="space-y-1">
        <h3 className="font-bold text-lob-dark">{title}</h3>
        <p className="text-sm text-lob-slate leading-snug">{body}</p>
      </div>
      <Button to={to} fullWidth>
        {action}
      </Button>
      {onDismiss ? (
        <div className="flex items-center justify-between gap-2">
          <p className="caption">{note}</p>
          <TextButton tone="neutral" size="sm" hitArea onClick={onDismiss}>
            Not now
          </TextButton>
        </div>
      ) : (
        <p className="caption text-center">{note}</p>
      )}
    </div>
  )
}
