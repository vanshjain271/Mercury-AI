import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MERCURY_MODULE } from "../../../../modules/mercury"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const mercuryService: any = req.scope.resolve(MERCURY_MODULE)
  const campaigns = await mercuryService.listCampaignProposals({}, { order: { created_at: "DESC" } })
  res.status(200).json({ campaigns })
}
