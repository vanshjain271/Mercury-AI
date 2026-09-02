"use server"

import * as medusa from "@/lib/medusa"
import { getCartId } from "@/lib/cart-cookie"

export interface RazorpaySessionResult {
  error?: string
  cartId?: string
  orderId?: string
  amount?: number
  currency?: string
  keyId?: string
  customerEmail?: string
}

/**
 * Creates (or reuses) the cart's Razorpay payment session and hands back
 * exactly what the client-side Razorpay Checkout widget needs. This calls
 * Medusa's own public Store API directly (no AI agent involved) - see the
 * module comment in lib/medusa.ts for why.
 */
export async function initiateRazorpayPaymentAction(email: string): Promise<RazorpaySessionResult> {
  const cartId = await getCartId()
  if (!cartId) return { error: "No active cart." }

  try {
    const cart = await medusa.getCart(cartId)
    if (cart.items.length === 0) return { error: "Your cart is empty." }
    if (cart.shipping_methods.length === 0) return { error: "No shipping method on this cart." }

    if (email && cart.email !== email) {
      await medusa.updateCartEmail(cartId, email)
    }

    const paymentCollection = await medusa.createPaymentCollection(cartId)
    const session = await medusa.initRazorpaySession(paymentCollection.id)

    return {
      cartId,
      orderId: session.data.order_id,
      amount: session.data.amount,
      currency: session.data.currency,
      keyId: session.data.key_id,
      customerEmail: email,
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}
