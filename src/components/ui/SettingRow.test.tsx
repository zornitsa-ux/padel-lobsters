// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { SettingRow } from './SettingRow'

afterEach(cleanup)

describe('SettingRow', () => {
  it('shows the label, value, control and any open content', () => {
    render(
      <SettingRow label="Email" value="ada@example.com" action={<span>Change</span>}>
        <p>form</p>
      </SettingRow>,
    )
    expect(screen.getByText('Email')).toBeTruthy()
    expect(screen.getByText('ada@example.com')).toBeTruthy()
    expect(screen.getByText('Change')).toBeTruthy()
    expect(screen.getByText('form')).toBeTruthy()
  })

  it('carries no spacing of its own outside', () => {
    const { container } = render(<SettingRow label="Email" />)
    expect((container.firstChild as HTMLElement).className).not.toMatch(/\b(m|mt|mb|my|p|px|py)-/)
  })
})
