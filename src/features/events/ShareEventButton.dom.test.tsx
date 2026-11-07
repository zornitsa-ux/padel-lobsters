// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import ShareEventButton from './ShareEventButton'

const event = {
  id: 't1',
  name: 'Lobster Cup',
  status: 'upcoming',
  date: '2099-06-01',
  maxPlayers: 16,
}

afterEach(cleanup)

describe('ShareEventButton', () => {
  it('renders nothing without an event id', () => {
    const { container } = render(<ShareEventButton event={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing once sign-ups close', () => {
    for (const closed of [
      { ...event, status: 'active' },
      { ...event, status: 'completed' },
      { ...event, date: '2020-06-01' },
    ]) {
      const { container } = render(<ShareEventButton event={closed} />)
      expect(container.innerHTML).toBe('')
      cleanup()
    }
  })

  it('opens the sheet with the event link and spots left', () => {
    render(<ShareEventButton event={event} registeredCount={10} />)

    fireEvent.click(screen.getByRole('button', { name: 'Share event' }))

    const message = screen.getByTestId('share-message').textContent
    expect(message).toContain('✅ 6 spots left')
    expect(message).toContain(`Sign up: ${window.location.origin}/events/t1`)
  })

  it('renders the full variant as "Share with friends"', () => {
    render(<ShareEventButton event={event} variant="full" />)
    fireEvent.click(screen.getByRole('button', { name: 'Share with friends' }))
    expect(screen.getByTestId('share-message')).toBeTruthy()
  })
})
