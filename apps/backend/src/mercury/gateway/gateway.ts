import { MERCURY_MODULE } from "../../modules/mercury"
import { evaluatePolicy } from "../policy/policy-engine"
import { logAgentAction, logAuditEvent } from "../audit/audit-logger"
import { getToolDefinition } from "./tool-registry"
import { ToolCallResult, ToolContext } from "./types"

/**
 * Mercury Agent Gateway.
 *
 * This is the ONLY path through which an AI agent can touch commerce or
 * merchant data. It is a straight, non-optional pipeline:
 *
 *   intent (tool name + input)
 *     -> validate required fields
 *     -> resolve the amount involved, if any
 *     -> Policy Engine decision (allowed / blocked / approval_required)
 *     -> execute (only if allowed) OR create an ApprovalRequest
 *     -> audit event, always
 *
 * The model never sees or influences policy - it can only ask, and the
 * gateway decides. See src/mercury/policy/policy-engine.ts.
 */
export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolCallResult> {
  const startedAt = Date.now()
  const tool = getToolDefinition(toolName)

  if (!tool) {
    await logAuditEvent(ctx.container, {
      sessionId: ctx.sessionId,
      actor: `${ctx.agentType}_agent`,
      eventType: "TOOL_NOT_FOUND",
      summary: `Requested unknown tool "${toolName}".`,
    })
    return { toolName, status: "error", error: `Unknown tool: ${toolName}` }
  }

  const missing = ((tool.inputSchema as any).required ?? []).filter(
    (key: string) => input[key] === undefined || input[key] === null
  )
  if (missing.length > 0) {
    return {
      toolName,
      status: "error",
      error: `Missing required input field(s): ${missing.join(", ")}`,
    }
  }

  let amountInr: number | undefined
  try {
    amountInr = await tool.amountInr?.(input, ctx)
  } catch {
    amountInr = undefined
  }

  const policyResult = await evaluatePolicy(ctx.container, {
    toolName,
    amountInr,
    sessionId: ctx.sessionId,
  })

  await logAgentAction(ctx.container, {
    sessionId: ctx.sessionId,
    agentType: ctx.agentType,
    actionType: "TOOL_CALL",
    toolName,
    inputSummary: input,
    policyResult: policyResult.decision,
    durationMs: Date.now() - startedAt,
  })

  if (policyResult.decision === "blocked") {
    await logAuditEvent(ctx.container, {
      sessionId: ctx.sessionId,
      actor: `${ctx.agentType}_agent`,
      eventType: "POLICY_BLOCKED",
      summary: `${toolName} blocked: ${policyResult.reason}`,
      metadata: { toolName, input, amountInr },
    })
    return { toolName, status: "blocked", reason: policyResult.reason }
  }

  if (policyResult.decision === "approval_required") {
    const mercuryService: any = ctx.container.resolve(MERCURY_MODULE)
    const [approval] = await mercuryService.createApprovalRequests([
      {
        session_id: ctx.sessionId,
        action_type: toolName,
        summary: `${toolName} for ₹${amountInr ?? "-"} requires human approval.`,
        payload: input,
        status: "pending",
      },
    ])

    await logAuditEvent(ctx.container, {
      sessionId: ctx.sessionId,
      actor: `${ctx.agentType}_agent`,
      eventType: "APPROVAL_REQUESTED",
      summary: `${toolName} requires approval (₹${amountInr ?? "-"}).`,
      metadata: { toolName, input, amountInr, approvalRequestId: approval.id },
    })

    return {
      toolName,
      status: "approval_required",
      reason: policyResult.reason,
      approvalRequestId: approval.id,
    }
  }

  try {
    const output = await tool.execute(input, ctx)
    await logAuditEvent(ctx.container, {
      sessionId: ctx.sessionId,
      actor: `${ctx.agentType}_agent`,
      eventType: `TOOL_EXECUTED:${toolName}`,
      summary: `${toolName} executed successfully.`,
      metadata: { input, output },
    })
    return { toolName, status: "executed", output }
  } catch (error) {
    const message = (error as Error).message
    await logAuditEvent(ctx.container, {
      sessionId: ctx.sessionId,
      actor: `${ctx.agentType}_agent`,
      eventType: `TOOL_ERROR:${toolName}`,
      summary: `${toolName} failed: ${message}`,
      metadata: { input },
    })
    return { toolName, status: "error", error: message }
  }
}

/**
 * Runs a tool that was previously deferred with `approval_required`, after
 * a human has approved it from the Merchant OS / Buyer approval UI. This
 * intentionally does NOT re-run the policy engine's allow/block decision -
 * a human already made the call - but it still audits the execution.
 */
export async function executeApprovedAction(
  approvalRequestId: string,
  decidedBy: string,
  ctx: ToolContext
): Promise<ToolCallResult> {
  const mercuryService: any = ctx.container.resolve(MERCURY_MODULE)
  const approval = await mercuryService.retrieveApprovalRequest(approvalRequestId)

  if (approval.status !== "pending") {
    return {
      toolName: approval.action_type,
      status: "error",
      error: `Approval request ${approvalRequestId} is already ${approval.status}.`,
    }
  }

  const tool = getToolDefinition(approval.action_type)
  if (!tool) {
    return { toolName: approval.action_type, status: "error", error: "Unknown tool." }
  }

  try {
    const output = await tool.execute(approval.payload, ctx)
    await mercuryService.updateApprovalRequests({
      id: approvalRequestId,
      status: "approved",
      decided_by: decidedBy,
      decided_at: new Date(),
    })
    await logAuditEvent(ctx.container, {
      sessionId: approval.session_id,
      actor: `human:${decidedBy}`,
      eventType: `APPROVAL_GRANTED:${approval.action_type}`,
      summary: `${decidedBy} approved and executed ${approval.action_type}.`,
      metadata: { input: approval.payload, output },
    })
    return { toolName: approval.action_type, status: "executed", output }
  } catch (error) {
    const message = (error as Error).message
    await logAuditEvent(ctx.container, {
      sessionId: approval.session_id,
      actor: `human:${decidedBy}`,
      eventType: `APPROVAL_EXECUTION_ERROR:${approval.action_type}`,
      summary: `Approved action ${approval.action_type} failed: ${message}`,
    })
    return { toolName: approval.action_type, status: "error", error: message }
  }
}

export async function rejectApprovalRequest(
  approvalRequestId: string,
  decidedBy: string,
  ctx: ToolContext
): Promise<void> {
  const mercuryService: any = ctx.container.resolve(MERCURY_MODULE)
  const approval = await mercuryService.retrieveApprovalRequest(approvalRequestId)
  await mercuryService.updateApprovalRequests({
    id: approvalRequestId,
    status: "rejected",
    decided_by: decidedBy,
    decided_at: new Date(),
  })
  await logAuditEvent(ctx.container, {
    sessionId: approval.session_id,
    actor: `human:${decidedBy}`,
    eventType: `APPROVAL_REJECTED:${approval.action_type}`,
    summary: `${decidedBy} rejected ${approval.action_type}.`,
  })
}
