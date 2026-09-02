import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { dismissCampaignProposalWorkflow } from "../../../../../../workflows/dismiss-campaign-proposal"
import { logAuditEvent } from "../../../../../../mercury/audit/audit-logger"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const campaignId = req.params.id
  const actorId = (req as any).auth_context?.actor_id ?? "unknown"

  const { result } = await dismissCampaignProposalWorkflow(req.scope).run({
    input: { campaignId },
  })

  await logAuditEvent(req.scope, {
    sessionId: result.sessionId,
    actor: `human:${actorId}`,
    eventType: "CAMPAIGN_DISMISSED",
    summary: `${actorId} dismissed campaign "${result.name}".`,
    metadata: { campaign_id: campaignId },
  })

  res.status(200).json({ campaign: result.campaign })
}
