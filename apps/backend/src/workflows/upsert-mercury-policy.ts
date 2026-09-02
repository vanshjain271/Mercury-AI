import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { MERCURY_MODULE } from "../modules/mercury"
import { DEFAULT_POLICIES } from "../mercury/policy/policy-engine"

export interface UpsertMercuryPolicyInput {
  toolName: string
  allowed?: boolean
  maxAmountInr?: number | null
  requiresApproval?: boolean
}

/**
 * Lets a Merchant OS user adjust the Policy Engine's authority ceilings
 * (see src/mercury/policy/policy-engine.ts) without a redeploy. Writes (or
 * updates) one row in the `policy` table; evaluatePolicy always reads that
 * table first and only falls back to DEFAULT_POLICIES when no row exists.
 */
const upsertMercuryPolicyStep = createStep(
  "upsert-mercury-policy",
  async (input: UpsertMercuryPolicyInput, { container }) => {
    const mercuryService: any = container.resolve(MERCURY_MODULE)
    const defaults = DEFAULT_POLICIES[input.toolName] ?? {
      allowed: false,
      maxAmountInr: null,
      requiresApproval: true,
      description: "Unknown tool - denied by default.",
    }

    const existing = await mercuryService.listPolicies({ tool_name: input.toolName })
    const previous = existing[0] ? { ...existing[0] } : null

    const patch = {
      tool_name: input.toolName,
      allowed: input.allowed ?? previous?.allowed ?? defaults.allowed,
      max_amount_inr: input.maxAmountInr !== undefined ? input.maxAmountInr : previous?.max_amount_inr ?? defaults.maxAmountInr,
      requires_approval: input.requiresApproval ?? previous?.requires_approval ?? defaults.requiresApproval,
      description: previous?.description ?? defaults.description,
    }

    const [policy] = previous
      ? await mercuryService.updatePolicies([{ id: previous.id, ...patch }])
      : await mercuryService.createPolicies([patch])

    return new StepResponse({ policy }, { previous, toolName: input.toolName })
  },
  async (compensation, { container }) => {
    if (!compensation?.previous) return
    const mercuryService: any = container.resolve(MERCURY_MODULE)
    await mercuryService.updatePolicies([{ id: compensation.previous.id, ...compensation.previous }])
  }
)

export const upsertMercuryPolicyWorkflow = createWorkflow(
  "upsert-mercury-policy",
  (input: UpsertMercuryPolicyInput) => {
    const result = upsertMercuryPolicyStep(input)
    return new WorkflowResponse(result)
  }
)
