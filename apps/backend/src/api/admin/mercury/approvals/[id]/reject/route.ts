import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { randomUUID } from "node:crypto"
import { rejectApprovalRequest } from "../../../../../../mercury/gateway/gateway"
import { ToolContext } from "../../../../../../mercury/gateway/types"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const approvalId = req.params.id
  const actorId = (req as any).auth_context?.actor_id ?? "unknown"

  const ctx: ToolContext = {
    container: req.scope,
    sessionId: randomUUID(),
    agentType: "merchant",
    actorId,
  }

  await rejectApprovalRequest(approvalId, actorId, ctx)
  res.status(200).json({ success: true })
}
