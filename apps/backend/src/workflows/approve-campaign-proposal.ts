import { MedusaError } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { MERCURY_MODULE } from "../modules/mercury"

export interface ApproveCampaignProposalInput {
  campaignId: string
  approvedBy: string
}

/**
 * The only path that turns a Mercury-drafted campaign proposal into an
 * active campaign - a human Merchant OS user, never the AI agent.
 * approveCampaignTool (in the Agent Gateway's tool registry) exists purely
 * so the model can *ask*; the policy engine always blocks it, and this
 * workflow is the real approval action it's blocked from reaching. See
 * src/api/admin/mercury/campaigns/[id]/approve/route.ts.
 */
const approveCampaignProposalStep = createStep(
  "approve-campaign-proposal",
  async (input: ApproveCampaignProposalInput, { container }) => {
    const mercuryService: any = container.resolve(MERCURY_MODULE)

    const campaign = await mercuryService.retrieveCampaignProposal(input.campaignId).catch(() => null)
    if (!campaign) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `No campaign proposal found with id ${input.campaignId}.`
      )
    }
    if (campaign.status !== "proposed" && campaign.status !== "draft") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Campaign ${input.campaignId} is already "${campaign.status}" and cannot be approved again.`
      )
    }

    const previousStatus = campaign.status
    const [updated] = await mercuryService.updateCampaignProposals([
      { id: input.campaignId, status: "active", approved_by: input.approvedBy, approved_at: new Date() },
    ])

    return new StepResponse({ campaign: updated, sessionId: campaign.created_by_session_id }, { campaignId: input.campaignId, previousStatus })
  },
  async (compensation, { container }) => {
    if (!compensation) return
    const mercuryService: any = container.resolve(MERCURY_MODULE)
    await mercuryService.updateCampaignProposals([
      { id: compensation.campaignId, status: compensation.previousStatus, approved_by: null, approved_at: null },
    ])
  }
)

export const approveCampaignProposalWorkflow = createWorkflow(
  "approve-campaign-proposal",
  (input: ApproveCampaignProposalInput) => {
    const result = approveCampaignProposalStep(input)
    return new WorkflowResponse(result)
  }
)
