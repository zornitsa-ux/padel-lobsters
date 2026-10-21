const keyFor = ({ playerId }: { playerId: string }) => `pl_upgrade_card_dismissed:${playerId}`

export function isUpgradeCardDismissed({ playerId }: { playerId: string }): boolean {
  try {
    return localStorage.getItem(keyFor({ playerId })) === '1'
  } catch {
    return false
  }
}

export function dismissUpgradeCard({ playerId }: { playerId: string }): void {
  try {
    localStorage.setItem(keyFor({ playerId }), '1')
  } catch {
    /* storage unavailable */
  }
}
