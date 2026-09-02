import { MedusaContainer } from "@medusajs/framework/types"
import { MERCURY_MODULE } from "../../modules/mercury"

/**
 * Every agent run is backed by a real AgentSession row from the moment it
 * starts - this is what session ids in the audit trail, policy
 * evaluations, and approval requests all point back to.
 */
export async function startAgentSession(
  container: MedusaContainer,
  input: {
    agentType: "buyer" | "merchant"
    actorId?: string | null
    actorLabel?: string | null
    metadata?: Record<string, unknown> | null
  }
): Promise<string> {
  const mercuryService: any = container.resolve(MERCURY_MODULE)
  const [session] = await mercuryService.createAgentSessions([
    {
      agent_type: input.agentType,
      actor_id: input.actorId ?? null,
      actor_label: input.actorLabel ?? null,
      status: "active",
      metadata: input.metadata ?? null,
    },
  ])
  return session.id
}

export async function endAgentSession(
  container: MedusaContainer,
  sessionId: string,
  status: "completed" | "aborted"
): Promise<void> {
  const mercuryService: any = container.resolve(MERCURY_MODULE)
  await mercuryService.updateAgentSessions({
    id: sessionId,
    status,
    ended_at: new Date(),
  })
}
