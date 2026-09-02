// Minimal, hand-picked slices of Medusa's Store API response shapes - only
// the fields Mercury's Buyer app actually reads. Deliberately not the full
// generated Medusa HttpTypes (this app never imports @medusajs/* packages),
// since a separate Next.js app talks to the backend purely over HTTP.

export interface MercuryRegion {
  id: string
  name: string
  currency_code: string
}

export interface MercuryProductVariant {
  id: string
  title: string
  sku: string | null
  inventory_quantity?: number | null
  calculated_price?: {
    calculated_amount: number
    currency_code: string
  } | null
  options?: { option_id: string; value: string }[]
}

export interface MercuryProductCategory {
  id: string
  name: string
  handle: string
}

export interface MercuryProduct {
  id: string
  title: string
  subtitle: string | null
  description: string | null
  handle: string
  thumbnail: string | null
  metadata: { rating?: number; features?: string[] } | null
  categories?: MercuryProductCategory[]
  variants: MercuryProductVariant[]
}

export interface MercuryLineItem {
  id: string
  title: string
  variant_id: string | null
  variant_title: string | null
  quantity: number
  unit_price: number
  total: number
  thumbnail: string | null
}

export interface MercuryShippingMethod {
  id: string
  name: string
}

export interface MercuryCart {
  id: string
  email: string | null
  currency_code: string
  region_id: string | null
  items: MercuryLineItem[]
  shipping_methods: MercuryShippingMethod[]
  item_total: number
  shipping_total: number
  tax_total: number
  total: number
}
