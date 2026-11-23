// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LevelInput } from './LevelInput'

afterEach(cleanup)

describe('LevelInput', () => {
  it('is a labelled text field with a decimal keypad, pointing at its hint', () => {
    render(<LevelInput label="Playtomic level" value="" onChange={() => {}} hint="On Playtomic." />)
    const field = screen.getByRole('textbox', { name: 'Playtomic level' })
    expect(field.getAttribute('inputmode')).toBe('decimal')
    expect(field.getAttribute('type')).toBe('text')
    expect(field.hasAttribute('aria-invalid')).toBe(false)
    expect(field.getAttribute('aria-describedby')).toBe(screen.getByText('On Playtomic.').id)
  })

  it('marks the field invalid and points it at the error and the hint', () => {
    render(
      <LevelInput label="Level" value="9" onChange={() => {}} error="Too high." hint="Hint." />,
    )
    const field = screen.getByRole('textbox', { name: 'Level' })
    expect(field.getAttribute('aria-invalid')).toBe('true')
    const ids = field.getAttribute('aria-describedby')?.split(' ')
    expect(ids).toEqual([screen.getByRole('alert').id, screen.getByText('Hint.').id])
  })

  it('announces a live error politely', () => {
    render(<LevelInput label="Level" value="9" onChange={() => {}} error="Too high." live />)
    expect(screen.getByRole('status').textContent).toContain('Too high.')
  })

  it('passes the typed text through as it is', () => {
    const onChange = vi.fn()
    render(<LevelInput label="Level" value="" onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '2,45' } })
    expect(onChange).toHaveBeenCalledWith('2,45')
  })

  it('sits in a Well when inset', () => {
    render(<LevelInput label="Level" value="" onChange={() => {}} inset />)
    expect(screen.getByRole('textbox').closest('.bg-lob-well')).not.toBeNull()
  })
})
