export type RazorpayOptions = {
  keyId: string
  keySecret: string
  /**
   * Used to verify the `X-Razorpay-Signature` header on incoming webhooks.
   * Optional only so the backend can boot without webhooks configured yet -
   * webhook-driven flows (async capture confirmation, payment.failed) simply
   * won't be actionable until it's set.
   */
  webhookSecret?: string
}
