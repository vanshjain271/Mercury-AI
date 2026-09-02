// Mercury's provider-agnostic AI abstraction. The agent loop (agent-loop.ts)
// only ever talks to the `AiProvider` interface below - it has no idea it's
// Anthropic under the hood. Swapping providers means writing a new adapter
// (like anthropic-provider.ts) that implements this interface; nothing else
// in Mercury changes.

export type AiToolSpec = {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export type AiContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean }

export type AiMessage = {
  role: "user" | "assistant"
  content: string | AiContentBlock[]
}

export interface AiCompletionRequest {
  system: string
  messages: AiMessage[]
  tools: AiToolSpec[]
  maxOutputTokens: number
}

export type AiStopReason = "end_turn" | "tool_use" | "max_tokens" | "other"

export interface AiCompletionResult {
  stopReason: AiStopReason
  /** The assistant's turn, verbatim - append this back into `messages` as-is. */
  content: AiContentBlock[]
  usage?: { inputTokens: number; outputTokens: number }
}

export interface AiProvider {
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>
}
