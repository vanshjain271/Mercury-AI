import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { ToolDefinition } from "../types"
import { MERCURY_MODULE } from "../../../modules/mercury"

export const analyzeRevenueTool: ToolDefinition = {
  name: "analyze_revenue",
  description:
    "Analyze real order data for a recent window: total revenue, order count, average order value, and the trend versus the prior window of the same length. Grounded entirely in the orders table - never invents numbers.",
  inputSchema: {
    type: "object",
    properties: {
      window_days: { type: "number", description: "Size of the analysis window in days (default 7)" },
    },
  },
  execute: async (input, ctx) => {
    const windowDays = input.window_days ?? 7
    const query = ctx.container.resolve(ContainerRegistrationKeys.QUERY)
    const now = new Date()
    const windowStart = new Date(now.getTime() - windowDays * 86400000)
    const priorStart = new Date(now.getTime() - 2 * windowDays * 86400000)

    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "total", "currency_code", "created_at", "items.title", "items.quantity", "items.total"],
      filters: { created_at: { $gte: priorStart.toISOString() } },
    })

    const rows = orders as { id: string; total: number; created_at: string; items: { title: string; quantity: number; total: number }[] }[]
    const current = rows.filter((o) => new Date(o.created_at) >= windowStart)
    const prior = rows.filter((o) => new Date(o.created_at) < windowStart)

    const sum = (list: typeof rows) => list.reduce((s, o) => s + Number(o.total ?? 0), 0)
    const currentRevenue = Math.round(sum(current))
    const priorRevenue = Math.round(sum(prior))
    const revenueChangePct =
      priorRevenue === 0 ? null : Math.round(((currentRevenue - priorRevenue) / priorRevenue) * 1000) / 10

    const productRevenue = new Map<string, number>()
    for (const order of current) {
      for (const item of order.items ?? []) {
        productRevenue.set(item.title, (productRevenue.get(item.title) ?? 0) + Number(item.total ?? 0))
      }
    }
    const topProducts = [...productRevenue.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([title, revenue]) => ({ title, revenue_inr: Math.round(revenue) }))

    return {
      window_days: windowDays,
      current: {
        revenue_inr: currentRevenue,
        order_count: current.length,
        average_order_value_inr: current.length ? Math.round(currentRevenue / current.length) : 0,
      },
      prior: {
        revenue_inr: priorRevenue,
        order_count: prior.length,
      },
      revenue_change_pct: revenueChangePct,
      top_products_by_revenue: topProducts,
    }
  },
}

export const findOpportunitiesTool: ToolDefinition = {
  name: "find_opportunities",
  description:
    "Read the current list of growth opportunities Mercury Intelligence has detected (abandoned carts, upsell/cross-sell, inventory risk, churn signals), most severe first.",
  inputSchema: {
    type: "object",
    properties: {
      status: { type: "string", description: "Filter by status, e.g. 'new'" },
      limit: { type: "number" },
    },
  },
  execute: async (input, ctx) => {
    const mercuryService: any = ctx.container.resolve(MERCURY_MODULE)
    const filter: Record<string, unknown> = {}
    if (input.status) filter.status = input.status
    // Sorted in JS rather than at the DB level: `severity` is a text enum
    // ("low" | "medium" | "high"), and an alphabetical DB sort does not
    // match true severity order (it would put "medium" first).
    const severityRank: Record<string, number> = { high: 3, medium: 2, low: 1 }
    const opportunities = await mercuryService.listOpportunities(filter, {
      order: { created_at: "DESC" },
    })
    const sorted = (opportunities as { severity: string }[])
      .sort((a, b) => (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0))
      .slice(0, input.limit ?? 20)
    return { opportunities: sorted }
  },
}

export const createCampaignProposalTool: ToolDefinition = {
  name: "create_campaign_proposal",
  description:
    "Draft a campaign proposal for merchant review (no spend happens until a human approves it). Estimates audience and revenue from real customer/order data.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string" },
      objective: { type: "string" },
      target_segment: { type: "string" },
      product_ids: { type: "array", items: { type: "string" } },
      strategy: { type: "string" },
      discount_percent: { type: "number" },
      duration_hours: { type: "number" },
    },
    required: ["name", "objective", "strategy"],
  },
  execute: async (input, ctx) => {
    const query = ctx.container.resolve(ContainerRegistrationKeys.QUERY)
    const mercuryService: any = ctx.container.resolve(MERCURY_MODULE)

    // Ground the audience/revenue estimate in real order history: customers
    // who have previously bought one of the target products (or any
    // customer, if none were specified).
    let estimatedAudience = 0
    let avgOrderValueInr = 0
    if (input.product_ids?.length) {
      const { data: orders } = await query.graph({
        entity: "order",
        fields: ["id", "email", "total", "items.product_id"],
      })
      const relevant = (orders as any[]).filter((o) =>
        (o.items ?? []).some((i: any) => input.product_ids.includes(i.product_id))
      )
      estimatedAudience = new Set(relevant.map((o) => o.email)).size
      avgOrderValueInr = relevant.length
        ? Math.round(relevant.reduce((s, o) => s + Number(o.total ?? 0), 0) / relevant.length)
        : 0
    } else {
      const { data: customers } = await query.graph({ entity: "customer", fields: ["id"] })
      estimatedAudience = (customers as any[]).length
    }

    const discountPercent = input.discount_percent ?? 0
    const projectedRevenueLow = Math.round(estimatedAudience * avgOrderValueInr * 0.05)
    const projectedRevenueHigh = Math.round(estimatedAudience * avgOrderValueInr * 0.12)
    const discountExposure = Math.round(((projectedRevenueLow + projectedRevenueHigh) / 2) * (discountPercent / 100))
    const risk = discountPercent > 25 ? "high" : discountPercent > 10 ? "medium" : "low"

    const [proposal] = await mercuryService.createCampaignProposals([
      {
        name: input.name,
        objective: input.objective,
        target_segment: input.target_segment ?? null,
        product_ids: input.product_ids ?? [],
        strategy: input.strategy,
        discount_percent: discountPercent,
        duration_hours: input.duration_hours ?? 48,
        estimated_audience: estimatedAudience,
        projected_revenue_low_inr: projectedRevenueLow,
        projected_revenue_high_inr: projectedRevenueHigh,
        discount_exposure_inr: discountExposure,
        risk,
        status: "proposed",
        created_by_session_id: ctx.sessionId,
      },
    ])

    return { proposal }
  },
}

/**
 * Approving a campaign always requires a human in the Merchant OS - see
 * src/api/admin/mercury/campaigns/[id]/approve/route.ts. This tool exists
 * so the model can request it (and the policy engine can correctly and
 * visibly block it) rather than silently having no way to even try.
 */
export const approveCampaignTool: ToolDefinition = {
  name: "approve_campaign",
  description:
    "Approve and activate a campaign proposal. Always blocked for autonomous agent execution - a human must approve from the Merchant OS.",
  inputSchema: {
    type: "object",
    properties: { campaign_id: { type: "string" } },
    required: ["campaign_id"],
  },
  execute: async () => {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "approve_campaign cannot be executed by an agent - this should have been blocked by policy."
    )
  },
}

export const refundPaymentTool: ToolDefinition = {
  name: "refund_payment",
  description:
    "Refund a captured payment. Always blocked for autonomous agent execution - not an autonomous action.",
  inputSchema: {
    type: "object",
    properties: { order_id: { type: "string" }, amount_inr: { type: "number" } },
    required: ["order_id"],
  },
  amountInr: (input) => input.amount_inr,
  execute: async () => {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "refund_payment cannot be executed by an agent - this should have been blocked by policy."
    )
  },
}
