import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { ToolDefinition } from "../types"
import {
  storeFetch,
  getCartTotals,
  getDefaultRegionId,
  getDefaultSalesChannelId,
  getRazorpayPaymentSession,
  RAZORPAY_PROVIDER_ID,
} from "../store-client"

export const addToCartTool: ToolDefinition = {
  name: "add_to_cart",
  description:
    "Add a product variant to a cart. Pass cart_id to add to an existing cart, or omit it to create a new one.",
  inputSchema: {
    type: "object",
    properties: {
      cart_id: { type: "string" },
      customer_email: { type: "string" },
      variant_id: { type: "string" },
      quantity: { type: "number" },
    },
    required: ["variant_id", "quantity"],
  },
  execute: async (input, ctx) => {
    let cartId = input.cart_id as string | undefined

    if (!cartId) {
      const [regionId, salesChannelId] = await Promise.all([
        getDefaultRegionId(ctx),
        getDefaultSalesChannelId(ctx),
      ])
      const { cart } = await storeFetch<{ cart: { id: string } }>(ctx, "/store/carts", {
        method: "POST",
        body: {
          region_id: regionId,
          sales_channel_id: salesChannelId,
          email: input.customer_email,
          items: [{ variant_id: input.variant_id, quantity: input.quantity }],
        },
      })
      cartId = cart.id
    } else {
      await storeFetch(ctx, `/store/carts/${cartId}/line-items`, {
        method: "POST",
        body: { variant_id: input.variant_id, quantity: input.quantity },
      })
    }

    const totals = await getCartTotals(ctx, cartId!)
    return { cart_id: cartId, ...totals }
  },
}

export const createPaymentSessionTool: ToolDefinition = {
  name: "create_payment_session",
  description:
    "Start a Razorpay (test mode) payment for the cart's current total. Requires policy approval above the configured autonomous limit.",
  inputSchema: {
    type: "object",
    properties: { cart_id: { type: "string" } },
    required: ["cart_id"],
  },
  amountInr: async (input, ctx) => {
    const totals = await getCartTotals(ctx, input.cart_id)
    return totals?.total_inr
  },
  execute: async (input, ctx) => {
    await storeFetch(ctx, "/store/payment-collections", {
      method: "POST",
      body: { cart_id: input.cart_id },
    })

    const query = ctx.container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: relations } = await query.graph({
      entity: "cart_payment_collection",
      fields: ["payment_collection.id"],
      filters: { cart_id: input.cart_id },
    })
    const paymentCollectionId = (relations as any[])[0]?.payment_collection?.id
    if (!paymentCollectionId) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Failed to create a payment collection for this cart."
      )
    }

    const { payment_collection } = await storeFetch<{
      payment_collection: { payment_sessions?: { id: string; provider_id: string; data: Record<string, unknown> }[] }
    }>(ctx, `/store/payment-collections/${paymentCollectionId}/payment-sessions`, {
      method: "POST",
      body: { provider_id: RAZORPAY_PROVIDER_ID },
    })

    const session = payment_collection.payment_sessions?.find(
      (s) => s.provider_id === RAZORPAY_PROVIDER_ID
    )

    return {
      payment_collection_id: paymentCollectionId,
      // `data` is what our Razorpay provider's initiatePayment() returned:
      // the Razorpay order id, amount, currency and the (public) key id the
      // Buyer app's checkout widget needs client-side.
      razorpay: session?.data,
    }
  },
}

export const completeOrderTool: ToolDefinition = {
  name: "complete_order",
  description:
    "Finalize a cart into a real order after the customer has completed the Razorpay checkout client-side. Pass the razorpay_payment_id and razorpay_signature returned by the Razorpay Checkout widget so Mercury can verify them before completing - never marks an order paid without that backend verification. This calls Medusa's own cart-completion workflow, which independently re-confirms the payment with Razorpay.",
  inputSchema: {
    type: "object",
    properties: {
      cart_id: { type: "string" },
      razorpay_payment_id: { type: "string" },
      razorpay_signature: { type: "string" },
    },
    required: ["cart_id"],
  },
  execute: async (input, ctx) => {
    const razorpayPaymentId = input.razorpay_payment_id as string | undefined
    const razorpaySignature = input.razorpay_signature as string | undefined

    if (razorpayPaymentId && razorpaySignature) {
      const session = await getRazorpayPaymentSession(ctx, input.cart_id as string)
      if (!session) {
        return {
          success: false,
          error: "No Razorpay payment session found for this cart. Call create_payment_session first.",
        }
      }

      const paymentModule: any = ctx.container.resolve(Modules.PAYMENT)
      try {
        // Delegates straight to our Razorpay provider's updatePayment(),
        // which does the actual HMAC signature verification (see
        // src/modules/razorpay/service.ts) - if it doesn't match, this
        // throws and the cart is never completed.
        await paymentModule.updatePaymentSession({
          id: session.id,
          amount: session.amount,
          currency_code: session.currency_code,
          data: {
            ...session.data,
            razorpay_payment_id: razorpayPaymentId,
            razorpay_signature: razorpaySignature,
          },
        })
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    }

    const result = await storeFetch<
      | { type: "order"; order: { id: string; display_id: number; total: number } }
      | { type: "cart"; cart: unknown; error: { message: string; type: string } }
    >(ctx, `/store/carts/${input.cart_id}/complete`, { method: "POST" })

    if (result.type === "order") {
      return {
        success: true,
        order_id: result.order.id,
        display_id: result.order.display_id,
        total_inr: Math.round(Number(result.order.total ?? 0)),
      }
    }
    return { success: false, error: result.error }
  },
}

export const getOrderTool: ToolDefinition = {
  name: "get_order",
  description: "Get an order's current status and totals.",
  inputSchema: {
    type: "object",
    properties: { order_id: { type: "string" } },
    required: ["order_id"],
  },
  execute: async (input, ctx) => {
    const query = ctx.container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "status",
        "total",
        "currency_code",
        "email",
        "created_at",
        "items.title",
        "items.quantity",
      ],
      filters: { id: input.order_id },
    })
    const order = (data as any[])[0]
    if (!order) return { found: false }
    return {
      found: true,
      order: { ...order, total_inr: Math.round(Number(order.total ?? 0)) },
    }
  },
}

export const getPaymentStatusTool: ToolDefinition = {
  name: "get_payment_status",
  description: "Get the payment status for a cart's payment collection.",
  inputSchema: {
    type: "object",
    properties: { cart_id: { type: "string" } },
    required: ["cart_id"],
  },
  execute: async (input, ctx) => {
    const query = ctx.container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "cart_payment_collection",
      fields: [
        "payment_collection.id",
        "payment_collection.status",
        "payment_collection.amount",
        "payment_collection.payments.id",
        "payment_collection.payments.captured_at",
        "payment_collection.payments.canceled_at",
      ],
      filters: { cart_id: input.cart_id },
    })
    const collection = (data as any[])[0]?.payment_collection
    if (!collection) return { found: false }
    return { found: true, payment_collection: collection }
  },
}
