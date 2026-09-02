// Central, typed access to Mercury's own environment configuration.
// Keeping every env var read in one place makes it obvious what Mercury
// needs to run and keeps defaults (especially the safety-relevant ones)
// visible in a single file instead of scattered across the codebase.

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const mercuryConfig = {
  ai: {
    provider: "anthropic" as const,
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    model: process.env.MERCURY_AI_MODEL ?? "claude-sonnet-5",
    // Hard ceilings so a bug or a confused conversation can never run away
    // with the Anthropic budget. These are enforced in code, not just
    // "requested" of the model.
    maxOutputTokens: readNumber("MERCURY_AI_MAX_OUTPUT_TOKENS", 1024),
    maxToolIterations: readNumber("MERCURY_AI_MAX_TOOL_ITERATIONS", 6),
    requestTimeoutMs: readNumber("MERCURY_AI_REQUEST_TIMEOUT_MS", 30_000),
    maxRetries: readNumber("MERCURY_AI_MAX_RETRIES", 1),
  },
  policy: {
    // Default authority ceilings for autonomous agent actions, in whole
    // INR rupees. These are the *fallback* values used when no row exists
    // yet in the `policy` table for a given tool - see
    // src/mercury/policy/policy-engine.ts.
    maxOrderInr: readNumber("MERCURY_AGENT_MAX_ORDER_INR", 5000),
    maxPaymentInr: readNumber("MERCURY_AGENT_MAX_PAYMENT_INR", 5000),
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID ?? "",
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
  },
  backendUrl: process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000",
  currencyCode: "inr",
}

export type MercuryConfig = typeof mercuryConfig
