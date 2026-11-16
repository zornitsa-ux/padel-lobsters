// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StepHeader } from './StepHeader'

afterEach(() => {
  cleanup()
})

const renderHeader = () => {
  const onBack = vi.fn()
  const onClose = vi.fn()
  const view = render(
    <StepHeader step={2} total={6} onBack={onBack} onClose={onClose} closeLabel="Stop" />,
  )
  return { ...view, onBack, onClose }
}

describe('StepHeader', () => {
  it('shows the step count and fills the bar to match', () => {
    const { container } = renderHeader()
    expect(screen.getByText('2 of 6')).toBeTruthy()
    const fill = container.querySelector<HTMLElement>('[style]')
    expect(fill?.style.width).toBe(`${(2 / 6) * 100}%`)
  })

  it('calls back and close', () => {
    const { onBack, onClose } = renderHeader()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(onBack).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('carries no margin of its own', () => {
    const { container } = renderHeader()
    expect((container.firstElementChild as HTMLElement).className).not.toMatch(
      /(^|\s)-?m[trblxy]?-/,
    )
  })
})
