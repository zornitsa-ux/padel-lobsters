// @vitest-environment jsdom
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ConfirmProvider } from './ConfirmDialog'
import { useConfirm } from '../../lib/confirmBus'

function ConfirmButton({ destructive = false }: { destructive?: boolean }) {
  const confirm = useConfirm()
  const [result, setResult] = useState<string>('unresolved')

  return (
    <div>
      <button
        onClick={async () => {
          const ok = await confirm({ message: 'Remove this item?', destructive })
          setResult(ok ? 'confirmed' : 'cancelled')
        }}
      >
        trigger
      </button>
      <p>result: {result}</p>
    </div>
  )
}

afterEach(() => {
  cleanup()
})

describe('ConfirmDialog', () => {
  it('resolves true when the confirm button is pressed', async () => {
    render(
      <ConfirmProvider>
        <ConfirmButton />
      </ConfirmProvider>,
    )

    fireEvent.click(screen.getByText('trigger'))
    expect(screen.getByText('Remove this item?')).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByText('Confirm'))
    })

    expect(screen.getByText('result: confirmed')).toBeTruthy()
    expect(screen.queryByText('Remove this item?')).toBeNull()
  })

  it('resolves false when the cancel button is pressed', async () => {
    render(
      <ConfirmProvider>
        <ConfirmButton />
      </ConfirmProvider>,
    )

    fireEvent.click(screen.getByText('trigger'))

    await act(async () => {
      fireEvent.click(screen.getByText('Cancel'))
    })

    expect(screen.getByText('result: cancelled')).toBeTruthy()
  })

  it('resolves false when dismissed via the backdrop', async () => {
    render(
      <ConfirmProvider>
        <ConfirmButton />
      </ConfirmProvider>,
    )

    fireEvent.click(screen.getByText('trigger'))
    const backdrop = screen.getByText('Remove this item?').closest('.fixed.inset-0')
    expect(backdrop).toBeTruthy()

    await act(async () => {
      fireEvent.click(backdrop as Element)
    })

    expect(screen.getByText('result: cancelled')).toBeTruthy()
  })

  it('always settles the promise, never leaving it pending', async () => {
    render(
      <ConfirmProvider>
        <ConfirmButton />
      </ConfirmProvider>,
    )

    fireEvent.click(screen.getByText('trigger'))
    await act(async () => {
      fireEvent.click(screen.getByText('Cancel'))
    })
    expect(screen.getByText('result: cancelled')).toBeTruthy()

    // Fire a second confirm/cancel round-trip — if the first promise had been
    // left unresolved, a stale resolve callback could fire again here and
    // this assertion would be racing against it.
    fireEvent.click(screen.getByText('trigger'))
    await act(async () => {
      fireEvent.click(screen.getByText('Confirm'))
    })
    expect(screen.getByText('result: confirmed')).toBeTruthy()
  })

  it('styles the confirm button as dangerous when destructive is set', () => {
    render(
      <ConfirmProvider>
        <ConfirmButton destructive />
      </ConfirmProvider>,
    )

    fireEvent.click(screen.getByText('trigger'))
    expect(screen.getByText('Confirm').className).toContain('btn-danger')
  })

  it('uses default labels when none are provided', () => {
    render(
      <ConfirmProvider>
        <ConfirmButton />
      </ConfirmProvider>,
    )

    fireEvent.click(screen.getByText('trigger'))
    expect(screen.getByText('Confirm')).toBeTruthy()
    expect(screen.getByText('Cancel')).toBeTruthy()
  })
})
