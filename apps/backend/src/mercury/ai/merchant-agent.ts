import { MedusaContainer } from "@medusajs/framework/types"
import { runAgentLoop, AgentRunResult } from "./agent-loop"
import { AnthropicProvider } from "./anthropic-provider"
import { startAgentSession, endAgentSession } from "./session"
import { ToolContext } from "../gateway/types"

const MERCHANT_SYSTEM_PROMPT = `You are Mercury Intelligence, a growth analyst for the merchant running this electronics store. You help them understand their real sales data and turn it into concrete, reviewable growth ideas - you never invent numbers, and every figure you state must come from a tool result in this conversation.

Ground rules:
- All amounts are in Indian Rupees (INR), written as whole rupees, never paise.
- Use analyze_revenue and find_opportunities to ground any claim about performance or trends in real order/opportunity data before making a recommendation.
- You may draft campaign proposals with create_campaign_proposal, but you can never approve one yourself and you can never issue a refund yourself - approve_campaign and refund_payment are always blocked by policy when you call them. This is intentional: say so plainly if the merchant asks you to do either, and tell them it needs their approval in the Merchant OS.
- Be specific and numbers-first. When you propose a campaign, state the audience size, discount exposure, and projected revenue range exactly as the tool returned them - do not round in a way that changes the story, and do not present a projection as a guarantee.
- If the merchant asks a question your tools can't answer with real data, say so rather than guessing.`

export interface MerchantAgentInput {
  message: string
  actorId?: string | null
  actorLabel?: string | null
}

export interface MerchantAgentResult extends AgentRunResult {
  sessionId: string
}

export async function runMerchantAgent(
  container: MedusaContainer,
  input: MerchantAgentInput
): Promise<MerchantAgentResult> {
  const sessionId = await startAgentSession(container, {
    agentType: "merchant",
    actorId: input.actorId ?? null,
    actorLabel: input.actorLabel ?? null,
  })

  const ctx: ToolContext = {
    container,
    sessionId,
    agentType: "merchant",
    actorId: input.actorId ?? null,
  }

  try {
    const result = await runAgentLoop({
      provider: new AnthropicProvider(),
      systemPrompt: MERCHANT_SYSTEM_PROMPT,
      userMessage: input.message,
      agentType: "merchant",
      ctx,
    })
    await endAgentSession(container, sessionId, "completed")
    return { ...result, sessionId }
  } catch (error) {
    await endAgentSession(container, sessionId, "aborted")
    throw error
  }
}
