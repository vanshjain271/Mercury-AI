import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MERCURY_MODULE } from "../../../../modules/mercury"

/**
 * Read-only feed backing the Merchant OS Audit Center: every policy
 * evaluation, agent tool execution, approval decision, and checkout result
 * Mercury has recorded (see src/mercury/audit/audit-logger.ts and the
 * gateway's calls into it) - append-only, newest first.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const mercuryService: any = req.scope.resolve(MERCURY_MODULE)
  const limit = req.query.limit ? Number(req.query.limit) : 50
  const offset = req.query.offset ? Number(req.query.offset) : 0

  const [events, count] = await mercuryService.listAndCountAuditEvents(
    {},
    { order: { created_at: "DESC" }, take: limit, skip: offset }
  )

  res.status(200).json({ events, count, limit, offset })
}
