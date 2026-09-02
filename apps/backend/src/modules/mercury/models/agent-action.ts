import { model } from "@medusajs/framework/utils"

const AgentAction = model.define("agent_action", {
  id: model.id({ prefix: "aact" }).primaryKey(),
  session_id: model.text().index("IDX_agent_action_session_id"),
  agent_type: model.enum(["buyer", "merchant"]),
  action_type: model.text(),
  tool_name: model.text().nullable(),
  input_summary: model.json().nullable(),
  result_summary: model.json().nullable(),
  policy_result: model
    .enum(["allowed", "blocked", "approval_required"])
    .nullable(),
  duration_ms: model.number().nullable(),
})

export default AgentAction
