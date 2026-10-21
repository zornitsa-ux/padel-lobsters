import { readStorage, writeStorage } from '../../lib/safeStorage'

export const UPGRADE_CARD_DISMISSED_EVENT = 'pl:upgrade-card-dismissed'

const keyFor = ({ playerId }: { playerId: string }) => `pl_upgrade_card_dismissed:${playerId}`

export function isUpgradeCardDismissed({ playerId }: { playerId: string }): boolean {
  return readStorage({ area: 'local', key: keyFor({ playerId }) }) === '1'
}

export function dismissUpgradeCard({ playerId }: { playerId: string }): void {
  writeStorage({ area: 'local', key: keyFor({ playerId }), value: '1' })
  window.dispatchEvent(new Event(UPGRADE_CARD_DISMISSED_EVENT))
}
