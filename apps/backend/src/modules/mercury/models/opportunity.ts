import { model } from "@medusajs/framework/utils"

const Opportunity = model.define("opportunity", {
  id: model.id({ prefix: "opp" }).primaryKey(),
  title: model.text(),
  category: model.enum([
    "abandoned_cart",
    "upsell",
    "cross_sell",
    "inventory_risk",
    "churn_signal",
    "bundle",
  ]),
  severity: model.enum(["low", "medium", "high"]).default("medium"),
  estimated_impact_inr: model.number().nullable(),
  confidence: model.number().nullable(),
  evidence: model.json().nullable(),
  recommended_action: model.text().nullable(),
  status: model
    .enum(["new", "reviewed", "approved", "executed", "completed", "dismissed"])
    .default("new"),
})

export default Opportunity
