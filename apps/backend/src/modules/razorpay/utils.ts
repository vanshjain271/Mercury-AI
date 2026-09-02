import { BigNumberInput } from "@medusajs/framework/types"

/**
 * Mercury's shop is INR-only and, per the seed data design (see
 * src/mercury/gateway/tools/catalog-tools.ts), every amount that flows
 * through Medusa's Query/Store API is already a whole rupee integer (never
 * paise, never a decimal fraction). Razorpay's API, however, always wants
 * amounts in the smallest currency subunit - paise - so this is the single
 * place that conversion happens.
 */
export function toPaise(amount: BigNumberInput): number {
  return Math.round(Number(amount) * 100)
}

export function fromPaise(paise: number): number {
  return Math.round(Number(paise) / 100)
}

/**
 * Wraps a third-party (SDK or network) error with context about which
 * Razorpay operation failed, without ever swallowing or faking success.
 */
export function buildRazorpayError(message: string, error: unknown): Error {
  const description =
    (error as { error?: { description?: string } })?.error?.description ??
    (error as Error)?.message ??
    String(error)
  return new Error(`${message}: ${description}`)
}
