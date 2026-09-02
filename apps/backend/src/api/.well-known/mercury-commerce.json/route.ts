import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { mercuryConfig } from "../../../../mercury/config"

/**
 * Agent-readable commerce discovery document, in the spirit of
 * /.well-known/ai-plugin.json - a single, public, unauthenticated URL any
 * AI agent (not just Mercury's own) can fetch to learn how this store can
 * be browsed and transacted with, and where the natural-language shopping
 * assistant lives. Values that describe this specific store (name,
 * currency) are read from Medusa's own data rather than hardcoded, so this
 * document can never drift from what the store actually is.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const [{ data: stores }, { data: regions }] = await Promise.all([
    query.graph({ entity: "store", fields: ["id", "name", "default_currency_code"] }),
    query.graph({ entity: "region", fields: ["id", "name", "currency_code"] }),
  ])

  const store = (stores as { name: string }[])[0]
  const region = (regions as { currency_code: string }[])[0]
  const currencyCode = (region?.currency_code ?? mercuryConfig.currencyCode).toUpperCase()
  const backendUrl = mercuryConfig.backendUrl

  res.status(200).json({
    protocol: "mercury-commerce",
    version: "1.0",
    store: {
      name: store?.name ?? "Mercury",
      currency: currencyCode,
      description:
        "An AI-native electronics store. Every AI-initiated action - browsing, cart, checkout, refunds - is mediated by the Mercury Agent Gateway and a real Policy Engine; nothing an agent does here bypasses human-configured spend limits or approval requirements.",
    },
    catalog: {
      description: "Read-only, public Medusa Store API - no authentication beyond the publishable key below.",
      list_products: { method: "GET", url: `${backendUrl}/store/products` },
      list_categories: { method: "GET", url: `${backendUrl}/store/product-categories` },
      auth: {
        type: "header",
        header: "x-publishable-api-key",
        description: "A Mercury Buyer App publishable key. Contact the store operator to obtain one.",
      },
    },
    agent: {
      description:
        "Natural-language shopping assistant. Send a message; it can search the catalog, add items to a cart, and check out with a real Razorpay (test mode) payment - subject to the same policy limits described below. It never claims a purchase or payment succeeded unless it actually did.",
      endpoint: { method: "POST", url: `${backendUrl}/store/mercury/agent` },
      request_body: {
        message: "string, required - the shopper's natural-language request",
        cart_id: "string, optional - an existing Medusa cart id to continue",
        customer_email: "string, optional",
      },
      response_body: {
        session_id: "string",
        reply: "string - the assistant's natural-language reply",
        tool_calls: "array - every tool the agent invoked and its outcome (executed | blocked | approval_required | error)",
        iterations: "number",
      },
      auth: {
        type: "header",
        header: "x-publishable-api-key",
      },
    },
    policy: {
      description:
        "Every agent action passes through a policy engine before it executes: money-moving actions above a merchant-configured limit require human approval and will never silently succeed, and some actions (refunds, campaign approval) are never autonomous at all.",
      autonomous_spend_limit_currency: currencyCode,
    },
  })
}
