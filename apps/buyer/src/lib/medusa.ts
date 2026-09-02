import { buyerConfig } from "./config"
import type { MercuryProduct, MercuryProductCategory, MercuryRegion, MercuryCart } from "@/types"

/**
 * Thin wrapper around Medusa's own public Store REST API. Every ordinary,
 * human-driven browsing/cart/checkout action in the Buyer app talks to
 * Medusa directly here - the same API any Medusa storefront would use.
 * Only the AI shopping assistant (see components/chat-widget.tsx) and the
 * final "complete checkout after a verified Razorpay payment" step (see
 * actions/checkout.ts) go through Mercury's own backend routes, because
 * those are the two places that need Mercury-specific behavior (agent tool
 * calls, or signature verification) that Medusa's stock API doesn't cover.
 */
async function storeFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!buyerConfig.publishableKey) {
    throw new Error(
      "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY is not set - run the Mercury seed script on the backend, copy the publishable key it prints, and set it in apps/buyer/.env.local."
    )
  }

  const res = await fetch(`${buyerConfig.medusaBackendUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-publishable-api-key": buyerConfig.publishableKey,
      ...init.headers,
    },
    cache: "no-store",
  })

  const text = await res.text()
  let json: unknown
  try {
    json = text ? JSON.parse(text) : undefined
  } catch {
    json = undefined
  }

  if (!res.ok) {
    const message =
      (json as { message?: string } | undefined)?.message ?? text ?? `Store API request failed (${res.status})`
    throw new Error(`${path} -> ${res.status}: ${message}`)
  }

  return json as T
}

let cachedRegion: MercuryRegion | null = null

export async function getRegion(): Promise<MercuryRegion> {
  if (cachedRegion) return cachedRegion
  const { regions } = await storeFetch<{ regions: MercuryRegion[] }>(
    "/store/regions?fields=id,name,currency_code"
  )
  const region = regions.find((r) => r.currency_code === buyerConfig.currencyCode) ?? regions[0]
  if (!region) {
    throw new Error("No region found - run the Mercury seed script on the backend first.")
  }
  cachedRegion = region
  return region
}

const PRODUCT_FIELDS =
  "id,title,subtitle,description,handle,thumbnail,metadata,*categories,*variants,*variants.options,+variants.calculated_price,+variants.inventory_quantity"

export async function listProducts(params: { categoryId?: string } = {}): Promise<MercuryProduct[]> {
  const region = await getRegion()
  const query = new URLSearchParams({
    region_id: region.id,
    fields: PRODUCT_FIELDS,
    limit: "100",
  })
  if (params.categoryId) query.set("category_id[]", params.categoryId)

  const { products } = await storeFetch<{ products: MercuryProduct[] }>(`/store/products?${query.toString()}`)
  return products
}

export async function getProductByHandle(handle: string): Promise<MercuryProduct | null> {
  const region = await getRegion()
  const query = new URLSearchParams({
    region_id: region.id,
    fields: PRODUCT_FIELDS,
    handle,
  })
  const { products } = await storeFetch<{ products: MercuryProduct[] }>(`/store/products?${query.toString()}`)
  return products[0] ?? null
}

export async function listCategories(): Promise<MercuryProductCategory[]> {
  const { product_categories } = await storeFetch<{ product_categories: MercuryProductCategory[] }>(
    "/store/product-categories?fields=id,name,handle&limit=50"
  )
  return product_categories
}

export async function createCart(input: {
  regionId: string
  email?: string | null
}): Promise<MercuryCart> {
  const { cart } = await storeFetch<{ cart: MercuryCart }>("/store/carts", {
    method: "POST",
    body: JSON.stringify({ region_id: input.regionId, email: input.email ?? undefined }),
  })
  return cart
}

export async function updateCartEmail(cartId: string, email: string): Promise<MercuryCart> {
  const { cart } = await storeFetch<{ cart: MercuryCart }>(`/store/carts/${cartId}`, {
    method: "POST",
    body: JSON.stringify({ email }),
  })
  return cart
}

export async function getCart(cartId: string): Promise<MercuryCart> {
  const { cart } = await storeFetch<{ cart: MercuryCart }>(
    `/store/carts/${cartId}?fields=*items,*items.variant,*shipping_methods,+shipping_methods.name`
  )
  return cart
}

export async function addLineItem(
  cartId: string,
  input: { variantId: string; quantity: number }
): Promise<MercuryCart> {
  const { cart } = await storeFetch<{ cart: MercuryCart }>(`/store/carts/${cartId}/line-items`, {
    method: "POST",
    body: JSON.stringify({ variant_id: input.variantId, quantity: input.quantity }),
  })
  return cart
}

export async function updateLineItem(
  cartId: string,
  lineItemId: string,
  quantity: number
): Promise<MercuryCart> {
  const { cart } = await storeFetch<{ cart: MercuryCart }>(
    `/store/carts/${cartId}/line-items/${lineItemId}`,
    { method: "POST", body: JSON.stringify({ quantity }) }
  )
  return cart
}

export async function removeLineItem(cartId: string, lineItemId: string): Promise<void> {
  await storeFetch(`/store/carts/${cartId}/line-items/${lineItemId}`, { method: "DELETE" })
}

export async function listShippingOptions(cartId: string): Promise<{ id: string; name: string }[]> {
  const { shipping_options } = await storeFetch<{ shipping_options: { id: string; name: string }[] }>(
    `/store/shipping-options?cart_id=${cartId}`
  )
  return shipping_options
}

export async function addShippingMethod(cartId: string, optionId: string): Promise<MercuryCart> {
  const { cart } = await storeFetch<{ cart: MercuryCart }>(`/store/carts/${cartId}/shipping-methods`, {
    method: "POST",
    body: JSON.stringify({ option_id: optionId }),
  })
  return cart
}

export async function createPaymentCollection(cartId: string): Promise<{ id: string }> {
  const { payment_collection } = await storeFetch<{ payment_collection: { id: string } }>(
    "/store/payment-collections",
    { method: "POST", body: JSON.stringify({ cart_id: cartId }) }
  )
  return payment_collection
}

export async function initRazorpaySession(paymentCollectionId: string): Promise<{
  id: string
  data: { order_id?: string; amount?: number; currency?: string; key_id?: string }
}> {
  const { payment_collection } = await storeFetch<{
    payment_collection: {
      payment_sessions?: { id: string; provider_id: string; data: Record<string, unknown> }[]
    }
  }>(`/store/payment-collections/${paymentCollectionId}/payment-sessions`, {
    method: "POST",
    body: JSON.stringify({ provider_id: "pp_razorpay_razorpay" }),
  })
  const session = payment_collection.payment_sessions?.find((s) => s.provider_id === "pp_razorpay_razorpay")
  if (!session) throw new Error("Razorpay did not return a payment session.")
  return { id: session.id, data: session.data as { order_id?: string; amount?: number; currency?: string; key_id?: string } }
}

export async function completeCheckout(input: {
  cartId: string
  razorpayPaymentId: string
  razorpaySignature: string
}): Promise<
  | { success: true; order_id: string; display_id: number; total_inr: number }
  | { success: false; error: unknown }
> {
  const res = await fetch(`${buyerConfig.medusaBackendUrl}/store/mercury/checkout/complete`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-publishable-api-key": buyerConfig.publishableKey,
    },
    body: JSON.stringify({
      cart_id: input.cartId,
      razorpay_payment_id: input.razorpayPaymentId,
      razorpay_signature: input.razorpaySignature,
    }),
    cache: "no-store",
  })
  return res.json()
}

export async function getOrder(orderId: string): Promise<{
  id: string
  display_id: number
  status: string
  total: number
  email: string
  items: { title: string; quantity: number }[]
} | null> {
  try {
    const { order } = await storeFetch<{
      order: {
        id: string
        display_id: number
        status: string
        total: number
        email: string
        items: { title: string; quantity: number }[]
      }
    }>(`/store/orders/${orderId}?fields=id,display_id,status,total,email,*items`)
    return order
  } catch {
    return null
  }
}
