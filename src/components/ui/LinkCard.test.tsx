// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ComponentProps } from 'react'
import { LinkCard, LinkCardIcon } from './LinkCard'

function renderCard(props: Omit<ComponentProps<typeof LinkCard>, 'to' | 'onClick' | 'title'> = {}) {
  return render(
    <MemoryRouter>
      <LinkCard to="/somewhere" title="Title" {...props} />
    </MemoryRouter>,
  )
}

afterEach(cleanup)

describe('LinkCard', () => {
  it('is a card-styled link to the target', () => {
    renderCard()
    const link = screen.getByRole('link', { name: 'Title' })
    expect(link.getAttribute('href')).toBe('/somewhere')
    expect(link.className).toContain('card')
  })

  it('renders without a leading tile when none is given', () => {
    const { container } = renderCard()
    expect(container.querySelector('.w-9')).toBeNull()
  })

  it('renders leading, subtitle and trailing slots', () => {
    renderCard({
      leading: <LinkCardIcon>L</LinkCardIcon>,
      subtitle: 'Sub',
      trailing: <span>Badge</span>,
    })
    expect(screen.getByText('L').className).toContain('bg-lob-cream')
    expect(screen.getByText('Sub')).toBeTruthy()
    expect(screen.getByText('Badge')).toBeTruthy()
  })
})

describe('LinkCard as an action', () => {
  it('renders a button that runs onClick', () => {
    const onClick = vi.fn()
    render(<LinkCard onClick={onClick} title="Open" />)
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
