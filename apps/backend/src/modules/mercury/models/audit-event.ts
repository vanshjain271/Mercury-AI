import { model } from "@medusajs/framework/utils"

const AuditEvent = model.define("audit_event", {
  id: model.id({ prefix: "aud" }).primaryKey(),
  session_id: model.text().nullable(),
  actor: model.text(),
  event_type: model.text(),
  summary: model.text(),
  metadata: model.json().nullable(),
})

export default AuditEvent
