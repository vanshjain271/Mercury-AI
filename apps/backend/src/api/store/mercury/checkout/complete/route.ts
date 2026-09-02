import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { randomUUID } from "node:crypto"
import { completeOrderTool } from "../../../../../mercury/gateway/tools/commerce-tools"
import { ToolContext } from "../../../../../mercury/gateway/types"
import { logAuditEvent } from "../../../../../mercury/audit/audit-logger"

type CompleteCheckoutRequestBody = {
  cart_id?: unknown
  razorpay_payment_id?: unknown
  razorpay_signature?: unknown
}

/**
 * Public (store) endpoint a human customer's own browser calls to finish
 * checkout after the Razorpay Checkout widget has already collected and
 * confirmed a real payment client-side.
 *
 * This is deliberately NOT part of the AI agent path: completing a
 * checkout you just paid for yourself is an ordinary, human-initiated
 * commerce action, not an autonomous agent decision, so it should not cost
 * an Anthropic API call or be subject to agent policy/approval gating. It
 * reuses completeOrderTool's exact verification logic (HMAC signature
 * check against the Payment Module, never a bare "mark as paid") so the
 * two paths - a customer clicking "Pay" and the Buyer AI agent checking
 * out on someone's behalf - can never diverge on what counts as a
 * verified payment.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = (req.body ?? {}) as CompleteCheckoutRequestBody

  if (typeof body.cart_id !== "string" || !body.cart_id) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "`cart_id` is required.")
  }
  if (typeof body.razorpay_payment_id !== "string" || !body.razorpay_payment_id) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "`razorpay_payment_id` is required.")
  }
  if (typeof body.razorpay_signature !== "string" || !body.razorpay_signature) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "`razorpay_signature` is required.")
  }

  const ctx: ToolContext = {
    container: req.scope,
    sessionId: randomUUID(),
    agentType: "buyer",
    actorId: (req as any).auth_context?.actor_id ?? null,
  }

  const result = await completeOrderTool.execute(
    {
      cart_id: body.cart_id,
      razorpay_payment_id: body.razorpay_payment_id,
      razorpay_signature: body.razorpay_signature,
    },
    ctx
  )

  await logAuditEvent(req.scope, {
    actor: "customer",
    eventType: (result as any).success ? "checkout.completed" : "checkout.failed",
    summary: (result as any).success
      ? `Order ${(result as any).display_id ?? (result as any).order_id} completed via customer checkout.`
      : `Customer checkout failed for cart ${body.cart_id}: ${JSON.stringify((result as any).error)}`,
    metadata: { cart_id: body.cart_id, ...result },
  })

  res.status(200).json(result)
}
