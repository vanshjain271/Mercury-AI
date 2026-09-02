# Mercury Merchant OS

The merchant-facing half of Mercury AI - revenue and opportunity dashboards, campaign approvals, the Policy Engine's spend-limit controls, the Audit Center, and a Merchant AI assistant. See the [repository root README](../../README.md) for setup and the overall architecture.

```bash
pnpm run merchant:dev   # from the repo root, http://localhost:3001
```

Sign in with a Medusa admin user (`pnpm exec medusa user -e ... -p ...` from `apps/backend`).
