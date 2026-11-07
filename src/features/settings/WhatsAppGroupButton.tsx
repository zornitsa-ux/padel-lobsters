import { MessageCircle } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../lib/toastBus'
import { useApp } from '../../context/useApp'
import { useSettings } from './useSettings'
import { openGroupLink } from './groupLink'

/**
 * Header link to the WhatsApp group. Members get the link from settings.
 * Signed-out visitors fetch it on tap, so it isn't in the page for crawlers.
 */
export function WhatsAppGroupButton() {
  const signedIn = !!useApp().session
  const { data: settings } = useSettings()
  const { showToast } = useToast()

  if (signedIn) {
    if (!settings?.whatsappLink) return null
    return (
      <Button
        variant="on-dark"
        size="sm"
        icon={<MessageCircle />}
        href={settings.whatsappLink}
        external
      >
        WhatsApp
      </Button>
    )
  }

  const open = async () => {
    if (await openGroupLink()) return
    showToast({ variant: 'error', message: "Couldn't open the WhatsApp group. Try again." })
  }
  return (
    <Button variant="on-dark" size="sm" icon={<MessageCircle />} onClick={open}>
      WhatsApp
    </Button>
  )
}
