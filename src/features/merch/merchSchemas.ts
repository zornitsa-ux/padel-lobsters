import { z } from 'zod'

// Boundary validation for the two tables the merch feature owns: merch_items
// and merch_interests (supabase/migrations/20250503000000_init.sql). We
// `.passthrough()` so unmodelled columns still reach the app, but every column
// the UI reads is checked here so a malformed row fails at the fetch boundary
// instead of rendering as `undefined` three components deep.
const nullableString = z.string().nullable().optional()
const nullableNumber = z.coerce.number().nullable().optional()

export const merchItemRowSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    description: nullableString,
    // numeric → the driver hands these back as strings
    price: nullableNumber,
    sizes: z.array(z.string()).nullable().optional(),
    image_url: nullableString,
    // jsonb column, always written as an array of public storage URLs
    image_urls: z.array(z.string()).nullable().optional(),
    category: nullableString,
    active: z.boolean().nullable().optional(),
    display_order: nullableNumber,
    external_orders: nullableNumber,
    created_at: nullableString,
  })
  .passthrough()

export const merchInterestRowSchema = z
  .object({
    id: z.number(),
    // text column — ids are compared as strings everywhere downstream
    player_id: nullableString,
    merch_item_id: nullableNumber,
    size: nullableString,
    custom_name: nullableString,
    status: nullableString,
    admin_comment: nullableString,
    cancelled_at: nullableString,
    paid: z.boolean().nullable().optional(),
    delivered: z.boolean().nullable().optional(),
    created_at: nullableString,
  })
  .passthrough()

export type MerchItemRow = z.infer<typeof merchItemRowSchema>
export type MerchInterestRow = z.infer<typeof merchInterestRowSchema>

export const ORDER_STATUSES = ['ordered', 'paid', 'delivered', 'cancelled'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

// Normalisation is additive: the raw row is spread through unchanged and the
// derived fields are layered on top. That matters because MyOrders is also
// rendered from Settings → Account, which still passes raw rows until pass B.
export type MerchItem = MerchItemRow & {
  price: number
  sizes: string[]
  images: string[]
  active: boolean
  displayOrder: number
  externalOrders: number
}

export type MerchInterest = MerchInterestRow & {
  status: OrderStatus
  customName: string
  playerId: string
}
