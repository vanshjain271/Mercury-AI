import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { ToolContext } from "./types"
import { mercuryConfig } from "../config"

/**
 * Mercury's commerce-mutating tools (add_to_cart, create_payment_session,
 * complete_order) call Medusa's own public Store REST API rather than
 * hand-rolling workflow orchestration. Medusa's core already implements
 * cart/checkout/payment correctly (tax, promotions, inventory reservation,
 * idempotency) - re-deriving that here would be slow to build and risky to
 * get right, and this is exactly the integration pattern a real storefront
 * uses. Reads (catalog, order status) go through Query directly instead,
 * since those don't need the extra validation/workflow machinery.
 */

let cachedPublishableKey: string | null = null
let cachedRegionId: string | null = null
let cachedSalesChannelId: string | null = null

async function getPublishableKey(ctx: ToolContext): Promise<string> {
  if (cachedPublishableKey) return cachedPublishableKey
  const query = ctx.container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "api_key",
    fields: ["id", "token", "type"],
    filters: { type: "publishable" },
  })
  const key = (data as { token: string }[])[0]
  if (!key) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No publishable API key found. Run the Mercury seed script first (pnpm run backend:seed)."
    )
  }
  cachedPublishableKey = key.token
  return cachedPublishableKey
}

export async function getDefaultRegionId(ctx: ToolContext): Promise<string> {
  if (cachedRegionId) return cachedRegionId
  const query = ctx.container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "region",
    fields: ["id", "currency_code"],
    filters: { currency_code: mercuryConfig.currencyCode },
  })
  const region = (data as { id: string }[])[0]
  if (!region) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No INR region found. Run the Mercury seed script first."
    )
  }
  cachedRegionId = region.id
  return cachedRegionId
}

export async function getDefaultSalesChannelId(ctx: ToolContext): Promise<string> {
  if (cachedSalesChannelId) return cachedSalesChannelId
  const query = ctx.container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "sales_channel",
    fields: ["id", "name"],
  })
  const channel = (data as { id: string }[])[0]
  if (!channel) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No sales channel found. Run the Mercury seed script first."
    )
  }
  cachedSalesChannelId = channel.id
  return cachedSalesChannelId
}

export async function storeFetch<T = any>(
  ctx: ToolContext,
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<T> {
  const publishableKey = await getPublishableKey(ctx)
  const res = await fetch(`${mercuryConfig.backendUrl}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "content-type": "application/json",
      "x-publishable-api-key": publishableKey,
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  })

  const text = await res.text()
  let json: any = undefined
  try {
    json = text ? JSON.parse(text) : undefined
  } catch {
    // non-JSON response body
  }

  if (!res.ok) {
    const message = json?.message ?? text ?? `Store API request failed (${res.status})`
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `${path} -> ${res.status}: ${message}`
    )
  }

  return json as T
}

export async function getCartTotals(
  ctx: ToolContext,
  cartId: string
): Promise<{ total_inr: number; currency_code: string; item_count: number } | null> {
  const query = ctx.container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: ["id", "total", "currency_code", "items.quantity"],
    filters: { id: cartId },
  })
  const cart = (data as any[])[0]
  if (!cart) return null
  const itemCount = (cart.items ?? []).reduce(
    (sum: number, item: { quantity: number }) => sum + (item.quantity ?? 0),
    0
  )
  return {
    total_inr: Math.round(Number(cart.total ?? 0)),
    currency_code: cart.currency_code,
    item_count: itemCount,
  }
}
