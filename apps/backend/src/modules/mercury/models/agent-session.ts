import { model } from "@medusajs/framework/utils"

const AgentSession = model.define("agent_session", {
  id: model.id({ prefix: "asess" }).primaryKey(),
  agent_type: model.enum(["buyer", "merchant"]),
  actor_id: model.text().nullable(),
  actor_label: model.text().nullable(),
  status: model.enum(["active", "completed", "aborted"]).default("active"),
  ended_at: model.dateTime().nullable(),
  metadata: model.json().nullable(),
})

export default AgentSession
