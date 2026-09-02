import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MERCURY_MODULE } from "../../modules/mercury"

export interface AuditEventInput {
  sessionId?: string | null
  actor: string
  eventType: string
  summary: string
  metadata?: Record<string, unknown> | null
}

export interface AgentActionInput {
  sessionId: string
  agentType: "buyer" | "merchant"
  actionType: string
  toolName?: string | null
  inputSummary?: Record<string, unknown> | null
  resultSummary?: Record<string, unknown> | null
  policyResult?: "allowed" | "blocked" | "approval_required" | null
  durationMs?: number | null
}

/**
 * Mercury's audit trail is append-only and best-effort: a logging failure
 * must never take down the actual commerce or agent action it is
 * describing, so every write here is wrapped and swallows its own errors
 * (after printing them) rather than throwing.
 */
export async function logAuditEvent(
  container: MedusaContainer,
  input: AuditEventInput
): Promise<void> {
  try {
    const mercuryService: any = container.resolve(MERCURY_MODULE)
    await mercuryService.createAuditEvents({
      session_id: input.sessionId ?? null,
      actor: input.actor,
      event_type: input.eventType,
      summary: input.summary,
      metadata: input.metadata ?? null,
    })
  } catch (error) {
    const logger = safeLogger(container)
    logger?.warn(`[mercury] failed to write audit event: ${(error as Error).message}`)
  }
}

export async function logAgentAction(
  container: MedusaContainer,
  input: AgentActionInput
): Promise<void> {
  try {
    const mercuryService: any = container.resolve(MERCURY_MODULE)
    await mercuryService.createAgentActions({
      session_id: input.sessionId,
      agent_type: input.agentType,
      action_type: input.actionType,
      tool_name: input.toolName ?? null,
      input_summary: input.inputSummary ?? null,
      result_summary: input.resultSummary ?? null,
      policy_result: input.policyResult ?? null,
      duration_ms: input.durationMs ?? null,
    })
  } catch (error) {
    const logger = safeLogger(container)
    logger?.warn(`[mercury] failed to write agent action: ${(error as Error).message}`)
  }
}

function safeLogger(container: MedusaContainer) {
  try {
    return container.resolve(ContainerRegistrationKeys.LOGGER) as {
      warn: (msg: string) => void
    }
  } catch {
    return null
  }
}
