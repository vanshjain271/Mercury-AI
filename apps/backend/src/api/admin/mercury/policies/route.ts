import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { MERCURY_MODULE } from "../../../../modules/mercury"
import { DEFAULT_POLICIES } from "../../../../mercury/policy/policy-engine"
import { upsertMercuryPolicyWorkflow } from "../../../../workflows/upsert-mercury-policy"
import { logAuditEvent } from "../../../../mercury/audit/audit-logger"

/**
 * Lets a Merchant OS user see and adjust the Policy Engine's authority
 * ceilings (see src/mercury/policy/policy-engine.ts) without a redeploy.
 * GET merges the DB's `policy` table over the hardcoded defaults, so every
 * tool the gateway knows about is always visible here, even before a
 * merchant has ever touched one.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const mercuryService: any = req.scope.resolve(MERCURY_MODULE)
  const rows: {
    tool_name: string
    allowed: boolean
    max_amount_inr: number | null
    requires_approval: boolean
    description: string | null
  }[] = await mercuryService.listPolicies({})
  const rowsByTool = new Map(rows.map((row) => [row.tool_name, row]))

  const policies = Object.entries(DEFAULT_POLICIES).map(([toolName, defaults]) => {
    const row = rowsByTool.get(toolName)
    return row
      ? {
          tool_name: toolName,
          allowed: row.allowed,
          max_amount_inr: row.max_amount_inr,
          requires_approval: row.requires_approval,
          description: row.description ?? defaults.description,
          is_default: false,
        }
      : {
          tool_name: toolName,
          allowed: defaults.allowed,
          max_amount_inr: defaults.maxAmountInr,
          requires_approval: defaults.requiresApproval,
          description: defaults.description,
          is_default: true,
        }
  })

  res.status(200).json({ policies })
}

type UpdatePolicyBody = {
  tool_name?: unknown
  allowed?: unknown
  max_amount_inr?: unknown
  requires_approval?: unknown
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = (req.body ?? {}) as UpdatePolicyBody
  if (typeof body.tool_name !== "string" || !(body.tool_name in DEFAULT_POLICIES)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "`tool_name` must be a known Mercury tool name.")
  }

  const actorId = (req as any).auth_context?.actor_id ?? "unknown"

  const { result } = await upsertMercuryPolicyWorkflow(req.scope).run({
    input: {
      toolName: body.tool_name,
      allowed: typeof body.allowed === "boolean" ? body.allowed : undefined,
      maxAmountInr:
        body.max_amount_inr === null || typeof body.max_amount_inr === "number" ? body.max_amount_inr : undefined,
      requiresApproval: typeof body.requires_approval === "boolean" ? body.requires_approval : undefined,
    },
  })

  await logAuditEvent(req.scope, {
    actor: `human:${actorId}`,
    eventType: "POLICY_UPDATED",
    summary: `${actorId} updated the policy for ${body.tool_name}.`,
    metadata: result.policy,
  })

  res.status(200).json({ policy: result.policy })
}
