import { MedusaContainer } from "@medusajs/framework/types"
import { MERCURY_MODULE } from "../../modules/mercury"
import { mercuryConfig } from "../config"

export type PolicyDecision = "allowed" | "blocked" | "approval_required"

export interface PolicyRule {
  allowed: boolean
  maxAmountInr: number | null
  requiresApproval: boolean
  description: string
}

export interface PolicyEvaluationInput {
  toolName: string
  /** Amount in whole INR rupees, when the tool being evaluated is money-moving. */
  amountInr?: number
  sessionId?: string | null
}

export interface PolicyEvaluationResult {
  decision: PolicyDecision
  reason: string
  rule: PolicyRule
}

/**
 * Default policy, used whenever no row exists yet in the `policy` table for
 * a given tool (e.g. right after a fresh install, before the seed script or
 * a merchant has configured anything). This is what makes the policy engine
 * safe by default rather than merely "safe once configured": an unknown,
 * money-moving tool is blocked, not silently allowed.
 */
const DEFAULT_POLICIES: Record<string, PolicyRule> = {
  search_products: {
    allowed: true,
    maxAmountInr: null,
    requiresApproval: false,
    description: "Search the product catalog.",
  },
  get_product: {
    allowed: true,
    maxAmountInr: null,
    requiresApproval: false,
    description: "Read a single product's details.",
  },
  compare_products: {
    allowed: true,
    maxAmountInr: null,
    requiresApproval: false,
    description: "Compare multiple products side by side.",
  },
  get_inventory: {
    allowed: true,
    maxAmountInr: null,
    requiresApproval: false,
    description: "Read stock levels for a product variant.",
  },
  add_to_cart: {
    allowed: true,
    maxAmountInr: null,
    requiresApproval: false,
    description: "Add an item to a cart.",
  },
  get_order: {
    allowed: true,
    maxAmountInr: null,
    requiresApproval: false,
    description: "Read an order's details.",
  },
  get_payment_status: {
    allowed: true,
    maxAmountInr: null,
    requiresApproval: false,
    description: "Read a payment's status.",
  },
  create_payment_session: {
    allowed: true,
    maxAmountInr: mercuryConfig.policy.maxPaymentInr,
    requiresApproval: true,
    description: "Start a Razorpay payment for the cart's current total.",
  },
  complete_order: {
    allowed: true,
    maxAmountInr: mercuryConfig.policy.maxOrderInr,
    requiresApproval: false,
    description:
      "Finalize an already-authorized payment into a real order (the money has already moved by this point; the spend limit was enforced at create_payment_session).",
  },
  refund_payment: {
    allowed: false,
    maxAmountInr: null,
    requiresApproval: true,
    description: "Refund a captured payment. Not autonomous - human only.",
  },
  analyze_revenue: {
    allowed: true,
    maxAmountInr: null,
    requiresApproval: false,
    description: "Read aggregated revenue/order analytics.",
  },
  find_opportunities: {
    allowed: true,
    maxAmountInr: null,
    requiresApproval: false,
    description: "Read the current list of growth opportunities.",
  },
  create_campaign_proposal: {
    allowed: true,
    maxAmountInr: null,
    requiresApproval: false,
    description: "Draft a campaign proposal for merchant review (no spend yet).",
  },
  approve_campaign: {
    allowed: false,
    maxAmountInr: null,
    requiresApproval: true,
    description: "Approve and activate a campaign. Human only.",
  },
}

/**
 * Evaluates whether a tool call is authorized. This is real application
 * logic - the LLM is never trusted to enforce its own limits. Every
 * evaluation is recorded to the `policy_evaluation` table for the Audit
 * Center, and reads its *rule* from the database first so a merchant can
 * tighten or loosen limits from the Merchant OS without a redeploy; it
 * only falls back to the hardcoded defaults above when no row exists yet.
 */
export async function evaluatePolicy(
  container: MedusaContainer,
  input: PolicyEvaluationInput
): Promise<PolicyEvaluationResult> {
  const mercuryService: any = container.resolve(MERCURY_MODULE)

  let rule: PolicyRule
  try {
    const rows = await mercuryService.listPolicies({ tool_name: input.toolName })
    const row = rows?.[0]
    rule = row
      ? {
          allowed: row.allowed,
          maxAmountInr: row.max_amount_inr,
          requiresApproval: row.requires_approval,
          description: row.description ?? "",
        }
      : DEFAULT_POLICIES[input.toolName] ?? {
          allowed: false,
          maxAmountInr: null,
          requiresApproval: true,
          description: "Unknown tool - denied by default.",
        }
  } catch {
    // Policy table not migrated/seeded yet - fall back to safe defaults
    // rather than failing the whole request.
    rule = DEFAULT_POLICIES[input.toolName] ?? {
      allowed: false,
      maxAmountInr: null,
      requiresApproval: true,
      description: "Unknown tool - denied by default.",
    }
  }

  let decision: PolicyDecision
  let reason: string

  if (!rule.allowed) {
    decision = "blocked"
    reason = `${input.toolName} is not enabled for autonomous agent execution.`
  } else if (
    rule.maxAmountInr != null &&
    input.amountInr != null &&
    input.amountInr > rule.maxAmountInr
  ) {
    decision = "blocked"
    reason = `Requested amount ₹${input.amountInr} exceeds the agent's authorized limit of ₹${rule.maxAmountInr} for ${input.toolName}.`
  } else if (rule.requiresApproval) {
    decision = "approval_required"
    reason = `${input.toolName} requires human approval before it can execute.`
  } else {
    decision = "allowed"
    reason = `${input.toolName} is within the agent's authorized policy.`
  }

  try {
    await mercuryService.createPolicyEvaluations({
      session_id: input.sessionId ?? null,
      tool_name: input.toolName,
      requested_amount_inr: input.amountInr ?? null,
      decision,
      reason,
    })
  } catch {
    // best effort - never let audit persistence block the actual decision
  }

  return { decision, reason, rule }
}

export { DEFAULT_POLICIES }
