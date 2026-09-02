import { model } from "@medusajs/framework/utils"

const ApprovalRequest = model.define("approval_request", {
  id: model.id({ prefix: "appr" }).primaryKey(),
  session_id: model.text().nullable(),
  action_type: model.text(),
  summary: model.text(),
  payload: model.json(),
  status: model.enum(["pending", "approved", "rejected"]).default("pending"),
  decided_by: model.text().nullable(),
  decided_at: model.dateTime().nullable(),
})

export default ApprovalRequest
