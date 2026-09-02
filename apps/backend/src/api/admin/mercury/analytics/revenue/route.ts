import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { randomUUID } from "node:crypto"
import { analyzeRevenueTool } from "../../../../../mercury/gateway/tools/merchant-tools"
import { ToolContext } from "../../../../../mercury/gateway/types"

/**
 * Plain (non-agent) Merchant OS endpoint backing the dashboard's revenue
 * chart. Reuses analyzeRevenueTool's exact query/aggregation logic so the
 * dashboard and the Merchant AI assistant can never disagree about what a
 * number means - but loading a dashboard should not cost an Anthropic API
 * call, so this bypasses the agent loop entirely.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const windowDays = Number(req.query.window_days) || 7

  const ctx: ToolContext = {
    container: req.scope,
    sessionId: randomUUID(),
    agentType: "merchant",
    actorId: (req as any).auth_context?.actor_id ?? null,
  }

  const result = await analyzeRevenueTool.execute({ window_days: windowDays }, ctx)
  res.status(200).json(result)
}
