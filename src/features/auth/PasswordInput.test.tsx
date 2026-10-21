// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PasswordInput } from './PasswordInput'

function Harness({ onSubmit = () => {} }: { onSubmit?: () => void }) {
  const [value, setValue] = useState('')
  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="pw">Secret</label>
      <PasswordInput id="pw" value={value} onChange={setValue} autoComplete="new-password" />
    </form>
  )
}

afterEach(cleanup)

describe('PasswordInput', () => {
  it('starts hidden and passes id and autoComplete through', () => {
    render(<Harness />)
    const input = screen.getByLabelText('Secret')
    expect(input.getAttribute('type')).toBe('password')
    expect(input.getAttribute('id')).toBe('pw')
    expect(input.getAttribute('autocomplete')).toBe('new-password')
    expect(screen.getByRole('button', { name: 'Show password' }).getAttribute('aria-pressed')).toBe(
      'false',
    )
  })

  it('toggles type, label and pressed state', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(screen.getByLabelText('Secret').getAttribute('type')).toBe('text')
    const hide = screen.getByRole('button', { name: 'Hide password' })
    expect(hide.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(hide)
    expect(screen.getByLabelText('Secret').getAttribute('type')).toBe('password')
  })

  it('does not submit the enclosing form', () => {
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('reports typed values', () => {
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Secret'), { target: { value: 'abc' } })
    expect((screen.getByLabelText('Secret') as HTMLInputElement).value).toBe('abc')
  })
})
