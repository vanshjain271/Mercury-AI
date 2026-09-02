import { mercuryConfig } from "../config"
import { executeTool } from "../gateway/gateway"
import { getToolsForAgent, toAnthropicToolSpec } from "../gateway/tool-registry"
import { logAuditEvent } from "../audit/audit-logger"
import { ToolContext } from "../gateway/types"
import { AiContentBlock, AiMessage, AiProvider } from "./types"

export interface AgentToolCallLogEntry {
  name: string
  status: string
}

export interface AgentRunResult {
  finalText: string
  iterations: number
  toolCalls: AgentToolCallLogEntry[]
  stopReason: string
}

/**
 * Mercury's bounded agent loop. This is the ONE place an AI provider's
 * output is turned into tool executions, and it is bounded on every axis
 * that matters for cost/safety:
 *  - `mercuryConfig.ai.maxToolIterations` caps how many model round-trips a
 *    single run can make, regardless of what the model asks for.
 *  - Every tool call still goes through the Agent Gateway's
 *    `executeTool()`, so policy evaluation/approval/audit apply exactly as
 *    they do for any other caller - the model gets no shortcut.
 *  - Output tokens per call are capped by the provider (see
 *    anthropic-provider.ts), not by this loop.
 *
 * This function has no idea it's talking to Claude specifically - it only
 * depends on the `AiProvider` interface.
 */
export async function runAgentLoop(params: {
  provider: AiProvider
  systemPrompt: string
  userMessage: string
  agentType: "buyer" | "merchant"
  ctx: ToolContext
}): Promise<AgentRunResult> {
  const { provider, systemPrompt, userMessage, agentType, ctx } = params
  const tools = getToolsForAgent(agentType).map(toAnthropicToolSpec)
  const messages: AiMessage[] = [{ role: "user", content: userMessage }]
  const toolCalls: AgentToolCallLogEntry[] = []
  const maxIterations = mercuryConfig.ai.maxToolIterations

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const result = await provider.complete({
      system: systemPrompt,
      messages,
      tools,
      maxOutputTokens: mercuryConfig.ai.maxOutputTokens,
    })
    messages.push({ role: "assistant", content: result.content })

    if (result.stopReason !== "tool_use") {
      const finalText = extractText(result.content)
      await logAuditEvent(ctx.container, {
        sessionId: ctx.sessionId,
        actor: `${agentType}_agent`,
        eventType: "AGENT_RUN_COMPLETE",
        summary: `${agentType} agent finished after ${iteration + 1} iteration(s).`,
        metadata: { stopReason: result.stopReason, toolCalls },
      })
      return { finalText, iterations: iteration + 1, toolCalls, stopReason: result.stopReason }
    }

    const toolUseBlocks = result.content.filter(
      (block): block is Extract<AiContentBlock, { type: "tool_use" }> =>
        block.type === "tool_use"
    )

    if (toolUseBlocks.length === 0) {
      // Model claimed tool_use but produced no tool_use blocks - treat as
      // a dead end rather than looping forever on nothing to act on.
      break
    }

    const toolResultBlocks: AiContentBlock[] = []
    for (const call of toolUseBlocks) {
      const toolResult = await executeTool(call.name, call.input, ctx)
      toolCalls.push({ name: call.name, status: toolResult.status })
      toolResultBlocks.push({
        type: "tool_result",
        tool_use_id: call.id,
        content: JSON.stringify(summarizeToolResult(toolResult)),
        is_error: toolResult.status === "error",
      })
    }
    messages.push({ role: "user", content: toolResultBlocks })
  }

  await logAuditEvent(ctx.container, {
    sessionId: ctx.sessionId,
    actor: `${agentType}_agent`,
    eventType: "AGENT_RUN_MAX_ITERATIONS",
    summary: `${agentType} agent hit its ${maxIterations}-iteration limit without finishing.`,
    metadata: { toolCalls },
  })

  return {
    finalText:
      "I wasn't able to finish within my step limit for this request - try rephrasing it more narrowly, or ask again.",
    iterations: maxIterations,
    toolCalls,
    stopReason: "max_iterations",
  }
}

function extractText(content: AiContentBlock[]): string {
  return content
    .filter((block): block is Extract<AiContentBlock, { type: "text" }> => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim()
}

function summarizeToolResult(toolResult: {
  status: string
  output?: unknown
  reason?: string
  approvalRequestId?: string
  error?: string
}): Record<string, unknown> {
  if (toolResult.status === "executed") {
    return { status: toolResult.status, result: toolResult.output }
  }
  return {
    status: toolResult.status,
    reason: toolResult.reason,
    approval_request_id: toolResult.approvalRequestId,
    error: toolResult.error,
  }
}
