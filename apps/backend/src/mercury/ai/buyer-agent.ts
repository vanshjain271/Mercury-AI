import { MedusaContainer } from "@medusajs/framework/types"
import { runAgentLoop, AgentRunResult } from "./agent-loop"
import { AnthropicProvider } from "./anthropic-provider"
import { startAgentSession, endAgentSession } from "./session"
import { ToolContext } from "../gateway/types"

const BUYER_SYSTEM_PROMPT = `You are the Mercury AI shopping assistant for an electronics store. You help customers find products, compare options, and check out - entirely through your tools. You never invent product names, prices, specs, or stock levels: every claim you make about the catalog must come from a tool result in this conversation.

Ground rules:
- All prices are in Indian Rupees (INR), written as whole rupees (e.g. "Rs 2,499"), never paise.
- Use search_products / get_product / compare_products to find and compare items before recommending anything.
- Check get_inventory before promising something is in stock.
- To buy something, call add_to_cart, then create_payment_session, then (after the customer completes payment in the app) complete_order.
- create_payment_session and complete_order may come back as "blocked" or "approval_required" - this is Mercury's real policy engine, not an error you caused. When that happens, explain plainly to the customer what happened and what they can do (e.g. a human needs to approve it, or the amount exceeds what you're allowed to do autonomously). Never claim a payment or order succeeded unless the tool result says it did.
- If complete_order reports success: false, tell the customer the payment did not go through and why (from the tool's error), and offer to retry rather than pretending it worked.
- Keep responses concise and concrete. Ask a clarifying question only when you genuinely cannot proceed without one.`

export interface BuyerAgentInput {
  message: string
  cartId?: string | null
  customerEmail?: string | null
  customerId?: string | null
}

export interface BuyerAgentResult extends AgentRunResult {
  sessionId: string
}

export async function runBuyerAgent(
  container: MedusaContainer,
  input: BuyerAgentInput
): Promise<BuyerAgentResult> {
  const sessionId = await startAgentSession(container, {
    agentType: "buyer",
    actorId: input.customerId ?? null,
    actorLabel: input.customerEmail ?? null,
    metadata: { cart_id: input.cartId ?? null },
  })

  const ctx: ToolContext = {
    container,
    sessionId,
    agentType: "buyer",
    actorId: input.customerId ?? null,
  }

  const contextLine = input.cartId
    ? `The customer already has an open cart: cart_id="${input.cartId}".`
    : "The customer does not have a cart yet - create one with add_to_cart when they're ready to buy."
  const customerLine = input.customerEmail
    ? `Customer email: ${input.customerEmail}.`
    : "This customer has not provided an email yet - ask for one before creating a cart if add_to_cart needs it."

  const userMessage = `${contextLine}\n${customerLine}\n\nCustomer message: ${input.message}`

  try {
    const result = await runAgentLoop({
      provider: new AnthropicProvider(),
      systemPrompt: BUYER_SYSTEM_PROMPT,
      userMessage,
      agentType: "buyer",
      ctx,
    })
    await endAgentSession(container, sessionId, "completed")
    return { ...result, sessionId }
  } catch (error) {
    await endAgentSession(container, sessionId, "aborted")
    throw error
  }
}
