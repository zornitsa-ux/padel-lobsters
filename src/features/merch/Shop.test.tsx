// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Shop from './Shop'
import type { MerchItem } from './merchSchemas'

const item = { id: 7, name: 'Cap', price: 20, images: [], sizes: [] } as unknown as MerchItem

const renderShop = (placing: Record<number, boolean>) =>
  render(
    <MemoryRouter>
      <Shop
        items={[item]}
        loading={false}
        isAdmin={false}
        claimedId="p1"
        selectedSize={{}}
        setSelectedSize={vi.fn()}
        sizeError={{}}
        setSizeError={vi.fn()}
        customName={{}}
        setCustomName={vi.fn()}
        ordered={{}}
        placing={placing}
        placeOrder={vi.fn()}
        orderCount={() => 0}
        websiteOrderCount={() => 0}
        setLightbox={vi.fn()}
      />
    </MemoryRouter>,
  )

afterEach(cleanup)

describe('Shop Order button', () => {
  it('is disabled while that order is being placed', () => {
    renderShop({ 7: true })
    expect(screen.getByRole('button', { name: 'Order' }).hasAttribute('disabled')).toBe(true)
  })

  it('is enabled otherwise', () => {
    renderShop({})
    expect(screen.getByRole('button', { name: 'Order' }).hasAttribute('disabled')).toBe(false)
  })
})
