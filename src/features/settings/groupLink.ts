import { fetchGroupLink } from './settingsQueries'

type OpenWindow = (url: string, target: string) => Window | null
type Navigate = (url: string) => void

/**
 * Opens the WhatsApp group for a signed-out visitor. The link is fetched on tap,
 * not shipped in the page, so crawlers don't collect it. The tab opens first,
 * inside the tap, or popup blockers would stop it once the fetch resolves; if
 * it's blocked anyway, the link opens in this tab.
 */
export async function openGroupLink({
  fetchLink = fetchGroupLink,
  open = (url, target) => window.open(url, target),
  navigate = (url) => window.location.assign(url),
}: {
  fetchLink?: () => Promise<string | null>
  open?: OpenWindow
  navigate?: Navigate
} = {}): Promise<boolean> {
  const tab = open('', '_blank')
  try {
    const link = await fetchLink()
    if (!link) {
      tab?.close()
      return false
    }
    // Blocked tab: a second window.open after the await would be blocked too.
    if (!tab) {
      navigate(link)
      return true
    }
    tab.opener = null
    tab.location.href = link
    return true
  } catch {
    tab?.close()
    return false
  }
}
