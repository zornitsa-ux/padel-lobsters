import { useLocation } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { levellingPath } from './levellingRoutes'
import { useIsExistingPlayer, useNeedsLevelling } from './useMyLevelling'

type Place = 'event' | 'home'

const IMPROVING =
  'We’ve improved how we match new players. Six quick questions help us put you in the right games from your first night.'
const NEWCOMER =
  'Tell us a bit about your padel so we can put you in matches that are fun for everyone.'
const FACTS = '6 quick questions · About a minute · Only once'

function copyFor({
  place,
  existing,
  hasLevel,
}: {
  place: Place
  existing: boolean
  hasLevel: boolean
}) {
  if (!existing) {
    return {
      title: place === 'home' ? 'Set your level' : 'One step before you join',
      body: `${NEWCOMER} Then you can register${place === 'home' ? ' for an event' : ''}.`,
      action: 'Set your level',
      note: FACTS,
    }
  }
  const note = hasLevel ? 'About a minute. Your Playtomic level is already filled in.' : FACTS
  return place === 'home'
    ? {
        title: 'We’re getting to know you better',
        body: IMPROVING,
        action: 'Answer 6 questions',
        note,
      }
    : {
        title: 'Quick check before you join',
        body: `${IMPROVING} Then you can register.`,
        action: 'Answer 6 questions',
        note,
      }
}

/**
 * Leads the viewer into the levelling flow, then back here. Render it only when they need
 * levelling (DESIGN §2.1): on an event page in place of Register, on Home above the next event.
 */
export default function LevellingCard({ place }: { place: Place }) {
  const { pathname, search } = useLocation()
  const { levelOnFile } = useNeedsLevelling()
  const existing = useIsExistingPlayer()
  // The wording depends on the account's age; wait for it rather than swap wording on screen.
  if (existing === undefined) return null
  const copy = copyFor({ place, existing, hasLevel: levelOnFile != null && levelOnFile > 0 })
  return (
    <div
      className={`card space-y-3 ${place === 'home' ? 'border-l-4 border-lob-teal' : ''}`.trim()}
      data-testid="levelling-card"
    >
      <div className="space-y-1">
        <h3 className="font-bold text-lob-dark">{copy.title}</h3>
        <p className="text-sm text-lob-slate leading-snug">{copy.body}</p>
      </div>
      <Button to={levellingPath({ from: pathname + search })} fullWidth>
        {copy.action}
      </Button>
      <p className="caption text-center">{copy.note}</p>
    </div>
  )
}
