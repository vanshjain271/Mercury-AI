import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { approveCampaignProposalWorkflow } from "../../../../../../workflows/approve-campaign-proposal"
import { logAuditEvent } from "../../../../../../mercury/audit/audit-logger"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const campaignId = req.params.id
  const actorId = (req as any).auth_context?.actor_id ?? "unknown"

  const { result } = await approveCampaignProposalWorkflow(req.scope).run({
    input: { campaignId, approvedBy: actorId },
  })

  await logAuditEvent(req.scope, {
    sessionId: result.sessionId,
    actor: `human:${actorId}`,
    eventType: "CAMPAIGN_APPROVED",
    summary: `${actorId} approved and activated campaign "${result.campaign.name}".`,
    metadata: { campaign_id: campaignId },
  })

  res.status(200).json({ campaign: result.campaign })
}
