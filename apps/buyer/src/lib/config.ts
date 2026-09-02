// Central, typed access to the Buyer app's environment configuration.
// Mirrors the backend's own src/mercury/config.ts pattern: one file, one
// source of truth for every env var this app reads.

export const buyerConfig = {
  medusaBackendUrl: process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000",
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "",
  currencyCode: "inr",
}
