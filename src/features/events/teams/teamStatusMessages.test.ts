import { describe, expect, it } from 'vitest'
import {
  CHANGE_PARTNER_MESSAGES,
  REGISTER_TEAM_MESSAGES,
  teamStatusMessage,
} from './teamStatusMessages'

describe('teamStatusMessage', () => {
  it('names the partner who has no level', () => {
    const message = teamStatusMessage({
      map: REGISTER_TEAM_MESSAGES,
      status: 'partner_needs_level',
      partnerName: 'Sam',
    })
    expect(message).toMatch(/^Sam hasn't set a level yet/)
  })

  it('falls back to "That player" without a name', () => {
    const message = teamStatusMessage({
      map: CHANGE_PARTNER_MESSAGES,
      status: 'partner_needs_level',
      partnerName: '',
    })
    expect(message).toMatch(/^That player hasn't set a level yet/)
  })

  it('reads any other status from the map', () => {
    expect(
      teamStatusMessage({
        map: REGISTER_TEAM_MESSAGES,
        status: 'captain_needs_level',
        partnerName: 'Sam',
      }),
    ).toBe(REGISTER_TEAM_MESSAGES.captain_needs_level)
  })
})
