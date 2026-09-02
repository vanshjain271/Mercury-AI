import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { runBuyerAgent } from "../../../../mercury/ai/buyer-agent"

type BuyerAgentRequestBody = {
  message?: unknown
  cart_id?: unknown
  customer_email?: unknown
}

/**
 * Public (store) entry point for the Mercury Buyer agent - this is the only
 * HTTP path that turns a customer's chat message into agent tool calls.
 * Guest checkout is allowed (Medusa's default store auth middleware permits
 * unauthenticated requests here), so an authenticated customer id is used
 * when present and a plain customer_email otherwise.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = (req.body ?? {}) as BuyerAgentRequestBody

  if (typeof body.message !== "string" || !body.message.trim()) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "`message` is required and must be a non-empty string."
    )
  }

  const customerId = (req as any).auth_context?.actor_id as string | undefined

  const result = await runBuyerAgent(req.scope, {
    message: body.message,
    cartId: typeof body.cart_id === "string" ? body.cart_id : null,
    customerEmail: typeof body.customer_email === "string" ? body.customer_email : null,
    customerId: customerId ?? null,
  })

  res.status(200).json({
    session_id: result.sessionId,
    reply: result.finalText,
    tool_calls: result.toolCalls,
    iterations: result.iterations,
  })
}
