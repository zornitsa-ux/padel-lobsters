// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { SwapPlayer } from './SwapPlayer'

afterEach(cleanup)

const props = { name: 'Rui Costa', label: 'Rui', side: 'left' as const, swapping: true }

describe('SwapPlayer', () => {
  it('inverts the picked player, so a teal letter colour never looks picked', () => {
    render(<SwapPlayer {...props} selected onTap={() => {}} />)
    expect(screen.getByText('R').className).toContain('bg-white text-lob-teal ring-2')
  })

  it('keeps the letter colour when not picked, and reports taps', () => {
    const onTap = vi.fn()
    render(<SwapPlayer {...props} selected={false} onTap={onTap} />)
    expect(screen.getByText('R').className).not.toContain('ring-lob-teal')
    fireEvent.click(screen.getByText('Rui'))
    expect(onTap).toHaveBeenCalledOnce()
  })

  it('faces the score: the right-hand team reads name then avatar', () => {
    const { container } = render(
      <SwapPlayer {...props} side="right" selected={false} onTap={() => {}} />,
    )
    expect((container.firstChild as HTMLElement).className).toContain('flex-row-reverse')
  })
})
