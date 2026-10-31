// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { LeagueTeam } from '../domain/types'

vi.mock('../hooks/useLeagueMutations', () => ({
  useConfirmGroups: () => ({ mutateAsync: vi.fn(), isPending: false, error: null }),
}))

import { GroupFormationTool } from './GroupFormationTool'

afterEach(cleanup)

const team = (id: string, team_name: string) =>
  ({ id, team_name, experience_level: 'intermediate', group_label: null }) as unknown as LeagueTeam

const renderTool = () =>
  render(
    <GroupFormationTool
      leagueId="l1"
      division="mens"
      teams={[team('t1', 'Smash Bros'), team('t2', 'Net Ninjas')]}
      onSuccess={vi.fn()}
    />,
  )

describe('GroupFormationTool', () => {
  it('lists unassigned teams as divided rows in the sheet, and says when a group is empty', () => {
    renderTool()
    expect(screen.getAllByText('No teams assigned')).toHaveLength(2)
    const unassigned = screen.getByText('Smash Bros').closest('ul')!
    expect(unassigned.className).toContain('divide-y')
    expect(unassigned.className).not.toContain('card')
  })

  it('moves a team into a group, which lists it as a row', () => {
    renderTool()
    const row = screen.getByText('Smash Bros').closest('li')!
    fireEvent.click(within(row).getByRole('button', { name: '→ A' }))

    const groupA = screen.getByRole('region', { name: /Group A \(1\)/ })
    expect(within(groupA).getByText('Smash Bros').closest('li')).toBeTruthy()
    expect(screen.getAllByText('No teams assigned')).toHaveLength(1)
  })
})
