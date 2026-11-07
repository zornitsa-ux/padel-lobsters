import { useMemo } from 'react'
import { useSettings } from '../settings/useSettings'
import { usePublicEvents } from '../events/public/usePublicEvents'
import DEFAULT_TIPS from '../../data/padelTips'
import { AlertBox } from '../../components/ui/AlertBox'
import LobsterWayLink from '../../components/LobsterWayLink'
import { GuestLeagueCard } from '../league/ui/GuestLeagueCard'
import type { NormalisedTournament } from '../../lib/normalise'
import Greeting from './Greeting'
import CountdownClock from './CountdownClock'
import TipOfTheDay from './TipOfTheDay'
import NextEventCard from './NextEventCard'
import useCountdown from './useCountdown'
import { countdownTarget, formatHomeDate, tipOfTheDay, upcomingEvents } from './homeHelpers'

interface GuestHomeProps {
  onNavigate: (page: string, payload?: NormalisedTournament) => void
}

/** Signed-out Home. Reads only what anon may read: public event facts, tips, league name. */
export default function GuestHome({ onNavigate }: GuestHomeProps) {
  const { data: events = [], isPending, isError } = usePublicEvents()
  const { data: settings } = useSettings()
  const upcoming = upcomingEvents({ events })[0]
  const countdown = useCountdown(countdownTarget({ events }))
  const tips = settings?.padelTips?.length ? settings.padelTips : DEFAULT_TIPS
  const todayTip = useMemo(() => tipOfTheDay({ tips }), [tips])

  return (
    <div className="-mx-4">
      <div className="px-4 pt-4 space-y-5">
        <Greeting
          hello="Welcome to Padel Lobsters!"
          sub="Sign in with your email to join the fun."
        />
        {isError && (
          <AlertBox variant="error">
            Upcoming events couldn&apos;t load. Pull to refresh or try again in a moment.
          </AlertBox>
        )}
        <CountdownClock countdown={countdown} streak={0} loading={isPending} />
        <TipOfTheDay tip={todayTip} />
        <GuestLeagueCard />
        <NextEventCard
          upcoming={upcoming}
          isAdmin={false}
          claimedId={null}
          isRegistered={false}
          loading={isPending}
          registeredCount={upcoming?.registeredCount}
          onNavigate={onNavigate}
          formatDate={formatHomeDate}
        />
        <LobsterWayLink />
      </div>
    </div>
  )
}
