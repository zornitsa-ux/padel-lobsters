import type { MerchItemInput } from './merchQueries'
import type { MerchItem } from './merchSchemas'

// Editor form state. price and external_orders stay strings while the admin is
// typing (they are bound to number inputs) and are coerced on save.
export type ItemFormState = {
  name: string
  description: string
  price: string
  sizes: string[]
  category: string
  image_url: string
  image_urls: string[]
  active: boolean
  external_orders: string | number
}

export const emptyItem: ItemFormState = {
  name: '',
  description: '',
  price: '',
  sizes: [],
  category: 'apparel',
  image_url: '',
  image_urls: [],
  active: true,
  external_orders: 0,
}

export const itemFormFrom = (item: MerchItem): ItemFormState => ({
  name: item.name,
  description: item.description ?? '',
  price: String(item.price),
  sizes: item.sizes,
  category: item.category ?? 'apparel',
  image_url: item.image_url ?? '',
  image_urls: item.images,
  active: item.active,
  external_orders: item.externalOrders,
})

// `active: true` is intentional — saving an item also un-deletes it, which is
// how an admin restores something removed by mistake.
export const toItemPayload = (form: ItemFormState): MerchItemInput => {
  const urls = form.image_urls ?? []
  return {
    name: form.name,
    description: form.description || '',
    price: parseFloat(form.price) || 0,
    sizes: form.sizes ?? [],
    image_url: urls[0] || form.image_url || '',
    image_urls: urls,
    category: form.category || 'apparel',
    active: true,
    external_orders: Math.max(0, parseInt(String(form.external_orders), 10) || 0),
  }
}
