import Anthropic from "@anthropic-ai/sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { mercuryConfig } from "../config"
import {
  AiCompletionRequest,
  AiCompletionResult,
  AiContentBlock,
  AiProvider,
  AiStopReason,
} from "./types"

/**
 * The only file in Mercury that talks to the Anthropic API directly.
 *
 * Every safety ceiling from Mercury's config is enforced here at the
 * transport level, not just requested of the model:
 *  - `max_tokens` is always mercuryConfig.ai.maxOutputTokens (a hard output
 *    cap per call - the caller cannot override it upward).
 *  - `timeout` and `maxRetries` are passed straight to the Anthropic SDK
 *    client, which owns request-level timeout/backoff behavior.
 * The bounded *iteration* count (how many round-trips a single agent run
 * may make) is enforced by the caller - see ai/agent-loop.ts.
 */
export class AnthropicProvider implements AiProvider {
  private client: Anthropic

  constructor() {
    if (!mercuryConfig.ai.apiKey) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "ANTHROPIC_API_KEY is not configured. Set it in apps/backend/.env before running an agent."
      )
    }
    this.client = new Anthropic({
      apiKey: mercuryConfig.ai.apiKey,
      timeout: mercuryConfig.ai.requestTimeoutMs,
      maxRetries: mercuryConfig.ai.maxRetries,
    })
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const response = await this.client.messages.create({
      model: mercuryConfig.ai.model,
      max_tokens: Math.min(request.maxOutputTokens, mercuryConfig.ai.maxOutputTokens),
      system: request.system,
      messages: request.messages.map((message) => ({
        role: message.role,
        content:
          typeof message.content === "string"
            ? message.content
            : message.content.map(toAnthropicBlockParam),
      })),
      tools: request.tools.length
        ? request.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.input_schema as Anthropic.Messages.Tool.InputSchema,
          }))
        : undefined,
    })

    const content: AiContentBlock[] = []
    for (const block of response.content) {
      if (block.type === "text") {
        content.push({ type: "text", text: block.text })
      } else if (block.type === "tool_use") {
        content.push({
          type: "tool_use",
          id: block.id,
          name: block.name,
          input: (block.input ?? {}) as Record<string, unknown>,
        })
      }
      // Other block types (thinking, server tool use, etc.) are not part of
      // Mercury's tool-use loop and are intentionally dropped rather than
      // silently mis-represented.
    }

    return {
      stopReason: toStopReason(response.stop_reason),
      content,
      usage: response.usage
        ? {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          }
        : undefined,
    }
  }
}

function toStopReason(stopReason: string | null): AiStopReason {
  if (stopReason === "tool_use") return "tool_use"
  if (stopReason === "end_turn" || stopReason === "stop_sequence") return "end_turn"
  if (stopReason === "max_tokens") return "max_tokens"
  return "other"
}

function toAnthropicBlockParam(block: AiContentBlock): Anthropic.Messages.ContentBlockParam {
  if (block.type === "text") {
    return { type: "text", text: block.text }
  }
  if (block.type === "tool_use") {
    return { type: "tool_use", id: block.id, name: block.name, input: block.input }
  }
  return {
    type: "tool_result",
    tool_use_id: block.tool_use_id,
    content: block.content,
    is_error: block.is_error,
  }
}
