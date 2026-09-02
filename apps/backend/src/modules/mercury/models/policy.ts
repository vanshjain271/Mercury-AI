import { model } from "@medusajs/framework/utils"

const Policy = model.define("policy", {
  id: model.id({ prefix: "pol" }).primaryKey(),
  tool_name: model.text().unique(),
  allowed: model.boolean().default(true),
  max_amount_inr: model.number().nullable(),
  requires_approval: model.boolean().default(false),
  description: model.text().nullable(),
})

export default Policy
