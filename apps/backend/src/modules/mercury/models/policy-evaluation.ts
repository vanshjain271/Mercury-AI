import { model } from "@medusajs/framework/utils"

const PolicyEvaluation = model.define("policy_evaluation", {
  id: model.id({ prefix: "polev" }).primaryKey(),
  session_id: model.text().nullable(),
  tool_name: model.text(),
  requested_amount_inr: model.number().nullable(),
  decision: model.enum(["allowed", "blocked", "approval_required"]),
  reason: model.text(),
})

export default PolicyEvaluation
