import { fetchGroupLink } from './settingsQueries'

type OpenWindow = (url: string, target: string) => Window | null

/**
 * Opens the WhatsApp group for a signed-out visitor. The link is fetched on tap,
 * not shipped in the page, so crawlers don't collect it. The tab opens first,
 * inside the tap, or popup blockers would stop it once the fetch resolves.
 */
export async function openGroupLink({
  fetchLink = fetchGroupLink,
  open = (url, target) => window.open(url, target),
}: { fetchLink?: () => Promise<string | null>; open?: OpenWindow } = {}): Promise<boolean> {
  const tab = open('', '_blank')
  try {
    const link = await fetchLink()
    if (!link) {
      tab?.close()
      return false
    }
    if (!tab) return open(link, '_blank') !== null
    tab.opener = null
    tab.location.href = link
    return true
  } catch {
    tab?.close()
    return false
  }
}
