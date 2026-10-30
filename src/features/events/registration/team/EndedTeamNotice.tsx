import { PARTNER_DECLINED_NOTICE } from '../../teams/teamStatusMessages'
import type { EndedTeamNotice as Ended } from './teamHelpers'
import { Button } from '../../../../components/ui/Button'
import { AlertBox } from '../../../../components/ui/AlertBox'

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
    <AlertBox
      variant="warning"
      actions={
        <Button onClick={onSignUpAgain} fullWidth>
          Sign up again
        </Button>
      }
    >
      {text}
    </AlertBox>
  )
}
