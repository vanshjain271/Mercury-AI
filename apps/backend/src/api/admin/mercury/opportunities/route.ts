import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { randomUUID } from "node:crypto"
import { findOpportunitiesTool } from "../../../../mercury/gateway/tools/merchant-tools"
import { ToolContext } from "../../../../mercury/gateway/types"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const ctx: ToolContext = {
    container: req.scope,
    sessionId: randomUUID(),
    agentType: "merchant",
    actorId: (req as any).auth_context?.actor_id ?? null,
  }

  const result = await findOpportunitiesTool.execute(
    {
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    },
    ctx
  )
  res.status(200).json(result)
}
