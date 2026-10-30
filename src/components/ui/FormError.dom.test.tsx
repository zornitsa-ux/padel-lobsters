// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { FormError } from './FormError'
import { useFieldError } from './useFieldError'

afterEach(() => {
  cleanup()
})

function LevelField({ error }: { error?: string }) {
  const { errorId, fieldProps } = useFieldError({ message: error })
  return (
    <div>
      <input aria-label="Level" {...fieldProps} />
      <FormError id={errorId} message={error} />
    </div>
  )
}

describe('FormError', () => {
  it('renders nothing without a message', () => {
    const { container } = render(<FormError message="" />)
    expect(container.innerHTML).toBe('')
  })

  it('announces the message as an alert in the danger colour, with no margin', () => {
    render(<FormError message="Enter a level." />)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toBe('Enter a level.')
    expect(alert.className).toContain('text-lob-danger')
    expect(alert.className).not.toMatch(/(^|\s)-?m[trblxy]?-/)
  })

  it('announces a check made while typing politely, as a status', () => {
    render(<FormError message="Enter a level between 0 and 7." polite />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe('Enter a level between 0 and 7.')
  })

  it('renders an inline action after the message', () => {
    render(<FormError message="Email in use." action={<a href="#members">Search members</a>} />)
    expect(screen.getByRole('alert').textContent).toBe('Email in use. Search members')
  })
})

describe('useFieldError', () => {
  it('marks the field invalid and points it at the error', () => {
    render(<LevelField error="Enter a level." />)
    const field = screen.getByRole('textbox', { name: 'Level' })
    expect(field.getAttribute('aria-invalid')).toBe('true')
    expect(field.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id)
  })

  it('leaves the field alone while there is no error', () => {
    render(<LevelField />)
    const field = screen.getByRole('textbox', { name: 'Level' })
    expect(field.hasAttribute('aria-invalid')).toBe(false)
    expect(field.hasAttribute('aria-describedby')).toBe(false)
  })
})
