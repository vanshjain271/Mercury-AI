import { model } from "@medusajs/framework/utils"

const CampaignProposal = model.define("campaign_proposal", {
  id: model.id({ prefix: "camp" }).primaryKey(),
  name: model.text(),
  objective: model.text(),
  target_segment: model.text().nullable(),
  product_ids: model.json().nullable(),
  strategy: model.text(),
  discount_percent: model.number().nullable(),
  duration_hours: model.number().nullable(),
  estimated_audience: model.number().nullable(),
  projected_revenue_low_inr: model.number().nullable(),
  projected_revenue_high_inr: model.number().nullable(),
  discount_exposure_inr: model.number().nullable(),
  risk: model.enum(["low", "medium", "high"]).default("low"),
  status: model
    .enum(["draft", "proposed", "approved", "active", "completed", "dismissed"])
    .default("draft"),
  approved_by: model.text().nullable(),
  approved_at: model.dateTime().nullable(),
  created_by_session_id: model.text().nullable(),
})

export default CampaignProposal
