import { MedusaService } from "@medusajs/framework/utils"
import {
  AgentSession,
  AgentAction,
  Policy,
  PolicyEvaluation,
  ApprovalRequest,
  AuditEvent,
  CampaignProposal,
  Opportunity,
} from "./models"

class MercuryModuleService extends MedusaService({
  AgentSession,
  AgentAction,
  Policy,
  PolicyEvaluation,
  ApprovalRequest,
  AuditEvent,
  CampaignProposal,
  Opportunity,
}) {}

export default MercuryModuleService
