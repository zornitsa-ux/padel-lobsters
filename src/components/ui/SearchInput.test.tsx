// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { SearchInput } from './SearchInput'

afterEach(cleanup)

function Harness({ onChange }: { onChange?: (v: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <SearchInput
      label="Search players"
      placeholder="Search players…"
      value={value}
      onChange={(v) => {
        setValue(v)
        onChange?.(v)
      }}
    />
  )
}

describe('SearchInput', () => {
  it('is named for screen readers by its label', () => {
    render(<Harness />)
    expect(screen.getByRole('textbox', { name: 'Search players' })).toBeTruthy()
  })

  it('reports the typed text as a string', () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ada' } })
    expect(onChange).toHaveBeenLastCalledWith('ada')
  })

  it('shows a clear button only once there is text, and clearing refocuses the field', () => {
    render(<Harness />)
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull()

    const field = screen.getByRole('textbox')
    fireEvent.change(field, { target: { value: 'ada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))

    expect((field as HTMLInputElement).value).toBe('')
    expect(document.activeElement).toBe(field)
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull()
  })

  it('offers no clear button when the field is disabled or read-only', () => {
    render(<SearchInput value="ada" onChange={() => {}} disabled />)
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull()
    cleanup()
    render(<SearchInput value="ada" onChange={() => {}} readOnly />)
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull()
  })

  it('passes other input props through, e.g. for a suggestion list', () => {
    render(<SearchInput value="" onChange={() => {}} aria-expanded aria-haspopup="menu" />)
    const field = screen.getByRole('textbox')
    expect(field.getAttribute('aria-haspopup')).toBe('menu')
    expect(field.getAttribute('aria-expanded')).toBe('true')
  })
})
