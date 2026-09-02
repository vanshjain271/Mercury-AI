# Mercury AI

An AI-native commerce operating system, built for the Razorpay AI Builder Internship 2026 (Track 1: AI Growth & Agentic Commerce).

Mercury is not a chatbot bolted onto a store. It is a real Medusa v2 commerce backend with two purpose-built frontends - a Buyer app and a Merchant OS - and, sitting between the two AI agents and the commerce data, a **Mercury Agent Gateway**: a structured tool registry and **Policy Engine** that mediates every single thing an AI is allowed to do. The model never touches the database, never decides its own spend limits, and never gets to claim a payment succeeded that didn't.

## Why it's built this way

Three ideas run through the whole codebase:

1. **The AI never has a back door.** Every commerce or merchant-data action an agent can take is a named tool in `apps/backend/src/mercury/gateway/tools/`, registered in a single tool registry, and executed only through `executeTool()` in `gateway.ts`. That function is a fixed pipeline - validate input, resolve the amount involved, ask the Policy Engine, then either execute, block, or queue for human approval - and it runs identically whether the caller is the Buyer agent or the Merchant agent.
2. **Policy is application logic, not a prompt.** `src/mercury/policy/policy-engine.ts` reads real limits from a database table (configurable live from the Merchant OS's Policy Engine page) and returns `allowed`, `blocked`, or `approval_required`. The LLM is told the result; it does not compute it.
3. **Nothing is faked.** Payments are real Razorpay test-mode orders, verified server-side with an HMAC signature check before an order is ever marked paid. Revenue numbers, inventory levels, and "opportunities" are all queries against the same database the store actually runs on - the seed script fabricates a demo merchant's history, but nothing downstream of that fabricates numbers on top of it.

## Architecture

```
apps/
  backend/         Medusa v2 commerce backend + Mercury's own module, gateway, and AI layer
    src/modules/mercury/       Data models: Opportunity, CampaignProposal, ApprovalRequest,
                                Policy, PolicyEvaluation, AuditEvent, AgentAction, AgentSession
    src/modules/razorpay/      Real AbstractPaymentProvider - Razorpay orders, HMAC signature
                                verification, refunds, webhook handling. Test mode only.
    src/mercury/gateway/       Tool registry + executeTool() - the ONLY path from AI to commerce
    src/mercury/policy/        Policy Engine - reads DB-backed limits, decides allow/block/approve
    src/mercury/audit/         Append-only audit logging used by every layer above
    src/mercury/ai/            Provider-agnostic AI layer (Anthropic today), bounded agent loop,
                                BuyerAgent and MerchantAgent system prompts
    src/api/store/mercury/agent        Buyer agent entry point (guest-allowed)
    src/api/admin/mercury/agent        Merchant agent entry point (real admin auth required)
    src/api/admin/mercury/*            Plain (non-agent) Merchant OS API: analytics, opportunities,
                                        campaigns, approvals, audit, policy - none of these cost an
                                        Anthropic call, only the agent endpoints do
    src/api/.well-known/mercury-commerce.json   Public, agent-readable discovery document
    src/scripts/seed-mercury.ts        Deterministic demo data for one fictional electronics store
  buyer/           Next.js Buyer app - browse, cart, Razorpay checkout, and an AI shopping assistant
  merchant-os/     Next.js Merchant OS - dashboard, opportunities, campaigns, approvals inbox,
                   policy controls, audit center, and a Merchant AI assistant
```

A deliberate split runs through both frontends: **ordinary human actions never touch the LLM.** Browsing products, adding to cart, checking out, loading a dashboard, approving a campaign - all of that talks directly to Medusa's own Store/Admin REST APIs (or a couple of small Mercury-specific routes for the few things those APIs don't cover, like verifying a Razorpay signature). The Anthropic API is called only when someone actually opens the chat widget and asks Mercury something. This is both a cost-safety measure and, we think, the honest design: an AI assistant should be an option, not a toll booth.

## Prerequisites

- Node.js 20+
- PostgreSQL 15+ (a [Neon](https://neon.tech) or other hosted Postgres works fine)
- pnpm 10.11.1 (`corepack enable` will pick up the version pinned in `package.json`)
- A [Razorpay](https://razorpay.com) account in **Test Mode** (Settings → API Keys)
- An [Anthropic API key](https://console.anthropic.com)

## Setup

```bash
pnpm install
```

### 1. Backend environment

```bash
cp apps/backend/.env.template apps/backend/.env
```

Fill in `apps/backend/.env`:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Your Postgres connection string |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay dashboard, **Test Mode** API keys |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay dashboard, Webhooks → the secret you set when adding one (see below) |

The rest of `.env.template` (model name, token/iteration/timeout limits, spend limits, CORS) has safe defaults already filled in - see `src/mercury/config.ts` for what each one bounds. You should not need to touch them to run the demo.

### 2. Database

```bash
cd apps/backend
pnpm exec medusa db:generate mercury   # generates migrations for Mercury's own data module
pnpm exec medusa db:migrate            # runs all migrations, including Medusa's own
pnpm exec medusa user -e admin@mercury.test -p supersecret   # your Merchant OS login
```

### 3. Seed the demo store

```bash
pnpm run backend:seed
```

This creates one fictional, internally-consistent electronics merchant: an India/INR store with Razorpay as the payment provider, 16 products across 7 categories (with deliberately varied stock so inventory-risk opportunities are real), 10 customers, about two weeks of historical orders with a mild real revenue trend, five abandoned carts, and the Mercury Intelligence opportunities computed from that same data. It prints a publishable API key at the end - copy it for the next step.

### 4. Frontend environments

```bash
cp apps/buyer/.env.template apps/buyer/.env.local
cp apps/merchant-os/.env.template apps/merchant-os/.env.local
```

Set `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` in `apps/buyer/.env.local` to the key the seed script printed.

### 5. Razorpay webhook (optional but recommended)

Medusa's payment module framework already exposes `POST /hooks/payment/pp_razorpay_razorpay` for every payment provider - there's no Mercury code to write here. Point a Razorpay webhook at `<your backend URL>/hooks/payment/pp_razorpay_razorpay`, subscribed to `payment.authorized`, `payment.captured`, and `payment.failed`, and set its signing secret as `RAZORPAY_WEBHOOK_SECRET`. In local development without a public URL, a tunnel (ngrok, Cloudflare Tunnel) in front of port 9000 works.

### 6. Run everything

```bash
pnpm run backend:dev     # http://localhost:9000  (Store/Admin API)
pnpm run buyer:dev       # http://localhost:3000   (Buyer app)
pnpm run merchant:dev    # http://localhost:3001   (Merchant OS - sign in with the admin user from step 2)
```

(`pnpm dev` at the root runs all three via Turborepo, if you'd rather not open three terminals.)

## Trying it out

- **As a shopper:** open the Buyer app, browse the catalog, and either add things to your cart normally or click "Ask Mercury AI" and say something like *"I need wireless headphones under ₹5000"* or *"add the Mercury SoundWave Pro to my cart and check out"*. Watch the tool-call log under each assistant reply - it tells you exactly which gateway tools ran and what the policy engine decided. At checkout, Razorpay's test mode accepts its [published test cards](https://razorpay.com/docs/payments/payments/test-card-upi-details/) (e.g. card `4111 1111 1111 1111`, any future expiry, any CVV).
- **As a merchant:** sign in to the Merchant OS and look at Overview, Opportunities, and Campaigns - all computed from what the seed script actually put in the database. Ask the Merchant assistant to draft a campaign proposal; it will show up on the Campaigns page needing your approval, because `approve_campaign` is unconditionally blocked for the agent by the Policy Engine. Try lowering a spend limit on the Policy Engine page to something small (e.g. ₹100 for `create_payment_session`), then ask the Buyer assistant to check out something more expensive - it will land in the Approvals inbox instead of silently failing or silently succeeding.

## Cost safety

This project runs on a small Anthropic budget by design, not by accident: `src/mercury/ai/` hard-caps `max_tokens` per call (`MERCURY_AI_MAX_OUTPUT_TOKENS`), the agent loop (`agent-loop.ts`) stops after a fixed number of tool-calling iterations (`MERCURY_AI_MAX_TOOL_ITERATIONS`) even if the model keeps asking for more, every request has a timeout, and retries are capped (`MERCURY_AI_REQUEST_TIMEOUT_MS`, `MERCURY_AI_MAX_RETRIES`). All of this lives in `src/mercury/config.ts`, not scattered across call sites.

## Known scope decisions

A few things were deliberately left out of this MVP's surface area rather than half-built:

- **Refunds** go through Medusa's own native Admin API (`/admin/payments/:id/refund`), not a custom Mercury UI. The important guarantee - that the AI agent can never issue one itself - is real and enforced (`refund_payment` is hardcoded `allowed: false` in the Policy Engine and throws if somehow reached), independent of which UI a human uses to actually process one.
- **Campaign execution** (actually running an approved campaign's discount) is out of scope; "approve and activate" records the decision and flips status, which is what the Policy Engine story needs to demonstrate.
- The Buyer app's cart id lives in a plain (non-secret) cookie, matching how Medusa's own storefront starter does it. The Merchant OS's admin session token is `httpOnly` and never reaches client-side JavaScript, including inside its own chat widget (which proxies through the Merchant OS's own `/api/chat` route instead of calling the backend directly).

See `AGENTS.md` for the repository's directory structure, commands, and coding conventions in more detail.
