import { describe, expect, it } from 'vitest'
import { describeDeletion } from './deletionSummary'
import type { DeletionSummary } from './deletionQueries'

const summary = (over: Partial<DeletionSummary> = {}): DeletionSummary => ({
  is_admin: false,
  in_live_event: false,
  upcoming: [],
  team_events: [],
  league_teams: [],
  open_shop_requests: 0,
  pending_transfers: 0,
  ...over,
})

const ids = (s: DeletionSummary) => describeDeletion({ summary: s }).map((line) => line.id)
const texts = (s: DeletionSummary) => describeDeletion({ summary: s }).map((line) => line.text)

describe('describeDeletion', () => {
  it('always says what is wiped, what stays and that it is final', () => {
    expect(ids(summary())).toEqual(['wiped', 'history', 'final'])
  })

  it('names upcoming solo spots and warns about paid ones only', () => {
    const lines = texts(
      summary({
        upcoming: [
          { tournament_id: 't1', name: 'Autumn Cup', date: '2026-12-05', paid: true, team: false },
          { tournament_id: 't2', name: 'Winter Cup', date: '2026-12-19', paid: false, team: false },
          { tournament_id: 't3', name: 'Pairs Night', date: '2026-12-12', paid: true, team: true },
        ],
      }),
    )

    expect(lines[0]).toMatch(
      /^Your spots in Autumn Cup \(.+\) and Winter Cup \(.+\) will be cancelled\.$/,
    )
    expect(lines[1]).toMatch(/^You've paid for Autumn Cup\. .*transfer the spot/)
    expect(lines.join(' ')).not.toContain('Pairs Night')
  })

  it('leaves out the paid warning when nothing is paid', () => {
    expect(
      ids(
        summary({
          upcoming: [
            { tournament_id: 't1', name: 'Autumn Cup', date: null, paid: false, team: false },
          ],
        }),
      ),
    ).toEqual(['upcoming', 'wiped', 'history', 'final'])
  })

  it('covers team events, league teams, transfers and shop requests', () => {
    const lines = texts(
      summary({
        team_events: [{ tournament_id: 't3', name: 'Pairs Night', is_captain: true }],
        league_teams: [{ league_id: 'l1', league_name: 'Summer League' }],
        pending_transfers: 1,
        open_shop_requests: 2,
      }),
    )

    expect(lines[0]).toMatch(/^Pairs Night: if your partner has accepted, they keep/)
    expect(lines[1]).toMatch(/^Summer League: you stay on your league team/)
    expect(lines[2]).toBe('Your pending spot transfer will be cancelled.')
    expect(lines[3]).toBe('Your 2 open shop requests will be cancelled.')
  })
})
