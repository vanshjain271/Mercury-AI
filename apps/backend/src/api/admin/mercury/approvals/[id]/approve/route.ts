import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { randomUUID } from "node:crypto"
import { executeApprovedAction } from "../../../../../../mercury/gateway/gateway"
import { ToolContext } from "../../../../../../mercury/gateway/types"

/**
 * A human Merchant OS user approving an agent action the policy engine
 * deferred (e.g. a create_payment_session over the autonomous spend limit).
 * This does not re-run the allow/block decision - the human's approval here
 * *is* the decision - but the action still executes through the same
 * gateway tool code as the agent would have used, and is still audited.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const approvalId = req.params.id
  const actorId = (req as any).auth_context?.actor_id ?? "unknown"

  const ctx: ToolContext = {
    container: req.scope,
    sessionId: randomUUID(),
    agentType: "merchant",
    actorId,
  }

  const result = await executeApprovedAction(approvalId, actorId, ctx)
  res.status(200).json(result)
}
