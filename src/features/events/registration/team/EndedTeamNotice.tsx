import { PARTNER_DECLINED_NOTICE } from '../../teams/teamStatusMessages'
import type { EndedTeamNotice as Ended } from './teamHelpers'
import { Button } from '../../../../components/ui/Button'

export const ADMIN_CANCELLED_NOTICE = 'An admin cancelled your team.'

export default function EndedTeamNotice({
  notice,
  onSignUpAgain,
}: {
  notice: Ended
  onSignUpAgain: () => void
}) {
  const text =
    notice.kind === 'partner_declined'
      ? PARTNER_DECLINED_NOTICE(notice.partnerName)
      : ADMIN_CANCELLED_NOTICE
  return (
    <div
      role="status"
      className="card bg-lob-warning-light border border-lob-warning-border space-y-2"
    >
      <p className="text-sm text-lob-warning-strong">{text}</p>
      <Button onClick={onSignUpAgain} fullWidth>
        Sign up again
      </Button>
    </div>
  )
}
