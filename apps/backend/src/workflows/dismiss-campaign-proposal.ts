import { MedusaError } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { MERCURY_MODULE } from "../modules/mercury"

export interface DismissCampaignProposalInput {
  campaignId: string
}

const dismissCampaignProposalStep = createStep(
  "dismiss-campaign-proposal",
  async (input: DismissCampaignProposalInput, { container }) => {
    const mercuryService: any = container.resolve(MERCURY_MODULE)

    const campaign = await mercuryService.retrieveCampaignProposal(input.campaignId).catch(() => null)
    if (!campaign) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `No campaign proposal found with id ${input.campaignId}.`
      )
    }

    const previousStatus = campaign.status
    const [updated] = await mercuryService.updateCampaignProposals([
      { id: input.campaignId, status: "dismissed" },
    ])

    return new StepResponse(
      { campaign: updated, name: campaign.name, sessionId: campaign.created_by_session_id },
      { campaignId: input.campaignId, previousStatus }
    )
  },
  async (compensation, { container }) => {
    if (!compensation) return
    const mercuryService: any = container.resolve(MERCURY_MODULE)
    await mercuryService.updateCampaignProposals([
      { id: compensation.campaignId, status: compensation.previousStatus },
    ])
  }
)

export const dismissCampaignProposalWorkflow = createWorkflow(
  "dismiss-campaign-proposal",
  (input: DismissCampaignProposalInput) => {
    const result = dismissCampaignProposalStep(input)
    return new WorkflowResponse(result)
  }
)
