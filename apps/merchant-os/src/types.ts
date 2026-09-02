export interface RevenueAnalysis {
  window_days: number
  current: { revenue_inr: number; order_count: number; average_order_value_inr: number }
  prior: { revenue_inr: number; order_count: number }
  revenue_change_pct: number | null
  top_products_by_revenue: { title: string; revenue_inr: number }[]
}

export interface Opportunity {
  id: string
  title: string
  category: "abandoned_cart" | "upsell" | "cross_sell" | "inventory_risk" | "churn_signal" | "bundle"
  severity: "low" | "medium" | "high"
  estimated_impact_inr: number | null
  confidence: number | null
  evidence: Record<string, unknown> | null
  recommended_action: string | null
  status: string
  created_at: string
}

export interface CampaignProposal {
  id: string
  name: string
  objective: string
  target_segment: string | null
  strategy: string
  discount_percent: number | null
  duration_hours: number | null
  estimated_audience: number | null
  projected_revenue_low_inr: number | null
  projected_revenue_high_inr: number | null
  discount_exposure_inr: number | null
  risk: "low" | "medium" | "high"
  status: string
  approved_by: string | null
  created_at: string
}

export interface ApprovalRequest {
  id: string
  session_id: string | null
  action_type: string
  summary: string
  payload: Record<string, unknown>
  status: "pending" | "approved" | "rejected"
  created_at: string
}

export interface AuditEvent {
  id: string
  session_id: string | null
  actor: string
  event_type: string
  summary: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface Policy {
  tool_name: string
  allowed: boolean
  max_amount_inr: number | null
  requires_approval: boolean
  description: string
  is_default: boolean
}
