import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MERCURY_MODULE } from "../../../../modules/mercury"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const mercuryService: any = req.scope.resolve(MERCURY_MODULE)
  const status = typeof req.query.status === "string" ? req.query.status : "pending"
  const approvals = await mercuryService.listApprovalRequests(
    status === "all" ? {} : { status },
    { order: { created_at: "DESC" } }
  )
  res.status(200).json({ approvals })
}
