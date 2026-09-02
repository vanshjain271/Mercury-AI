import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { runMerchantAgent } from "../../../../mercury/ai/merchant-agent"

type MerchantAgentRequestBody = {
  message?: unknown
}

/**
 * Admin-only entry point for the Mercury Intelligence (merchant) agent.
 * Medusa's default admin auth middleware requires a real authenticated
 * admin user for anything under /admin - there is no separate auth check
 * to write here.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = (req.body ?? {}) as MerchantAgentRequestBody

  if (typeof body.message !== "string" || !body.message.trim()) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "`message` is required and must be a non-empty string."
    )
  }

  const authContext = (req as any).auth_context
  const actorId = authContext?.actor_id as string | undefined
  const actorLabel = (authContext?.app_metadata?.email as string | undefined) ?? actorId

  const result = await runMerchantAgent(req.scope, {
    message: body.message,
    actorId: actorId ?? null,
    actorLabel: actorLabel ?? null,
  })

  res.status(200).json({
    session_id: result.sessionId,
    reply: result.finalText,
    tool_calls: result.toolCalls,
    iterations: result.iterations,
  })
}
