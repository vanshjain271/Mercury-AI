"use server"

import { revalidatePath } from "next/cache"
import * as medusa from "@/lib/medusa"
import { getCartId, setCartId } from "@/lib/cart-cookie"

async function ensureCart(): Promise<string> {
  const existing = await getCartId()
  if (existing) {
    // Confirm the cart is still valid (e.g. it wasn't already completed
    // into an order in another tab) before reusing it.
    try {
      await medusa.getCart(existing)
      return existing
    } catch {
      // fall through and create a fresh one
    }
  }
  const region = await medusa.getRegion()
  const cart = await medusa.createCart({ regionId: region.id })
  await setCartId(cart.id)
  return cart.id
}

export async function addToCartAction(variantId: string, quantity: number): Promise<{ error?: string }> {
  try {
    const cartId = await ensureCart()
    let cart = await medusa.addLineItem(cartId, { variantId, quantity })

    // Every product Mercury sells requires shipping, and Medusa refuses to
    // complete a cart with no shipping method attached - see the matching
    // comment in the backend's store-client.ts. Attach it the first time a
    // cart gets an item, exactly like the AI agent's add_to_cart tool does.
    if (cart.shipping_methods.length === 0) {
      const options = await medusa.listShippingOptions(cartId)
      if (options[0]) {
        cart = await medusa.addShippingMethod(cartId, options[0].id)
      }
    }

    revalidatePath("/", "layout")
    return {}
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function updateLineItemAction(lineItemId: string, quantity: number): Promise<{ error?: string }> {
  try {
    const cartId = await getCartId()
    if (!cartId) return { error: "No active cart." }
    await medusa.updateLineItem(cartId, lineItemId, quantity)
    revalidatePath("/", "layout")
    return {}
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function removeLineItemAction(lineItemId: string): Promise<{ error?: string }> {
  try {
    const cartId = await getCartId()
    if (!cartId) return { error: "No active cart." }
    await medusa.removeLineItem(cartId, lineItemId)
    revalidatePath("/", "layout")
    return {}
  } catch (error) {
    return { error: (error as Error).message }
  }
}
