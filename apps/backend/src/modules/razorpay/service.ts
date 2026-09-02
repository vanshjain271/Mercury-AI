import crypto from "crypto"
import Razorpay from "razorpay"
import {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import {
  AbstractPaymentProvider,
  MedusaError,
  PaymentActions,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import { RazorpayOptions } from "./types"
import { buildRazorpayError, fromPaise, toPaise } from "./utils"

/**
 * Mercury's real (test-mode) Razorpay payment provider.
 *
 * This is the only place Razorpay's API key/secret are used. It never
 * fabricates a successful payment: every status transition this provider
 * reports back to Medusa is read directly from Razorpay's API or verified
 * with an HMAC signature check against Razorpay's own secret - if Razorpay
 * says a payment failed, Mercury reports it failed.
 *
 * Flow:
 *  1. initiatePayment  - creates a Razorpay Order for the cart's total.
 *  2. (client-side)    - the Buyer app's Razorpay Checkout widget collects
 *                        payment details and returns razorpay_payment_id +
 *                        razorpay_signature to Mercury.
 *  3. updatePayment    - Mercury's create_payment_session/complete_order
 *                        tools attach + verify that payment id/signature
 *                        before the cart is completed.
 *  4. authorizePayment - called by Medusa's cart-completion workflow; polls
 *                        Razorpay for the real payment status.
 *  5. capturePayment   - captures if Razorpay reports "authorized" (manual
 *                        capture); is a no-op confirmation if already
 *                        "captured" (Razorpay auto-captures most methods).
 */
class RazorpayProviderService extends AbstractPaymentProvider<RazorpayOptions> {
  static identifier = "razorpay"

  protected readonly options_: RazorpayOptions
  protected client_: Razorpay

  static validateOptions(options: RazorpayOptions): void {
    if (!options.keyId || !options.keySecret) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Razorpay payment provider requires `keyId` and `keySecret` options (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)."
      )
    }
  }

  constructor(cradle: Record<string, unknown>, options: RazorpayOptions) {
    // @ts-ignore - AbstractPaymentProvider's constructor is variadic in practice.
    super(...arguments)
    this.options_ = options
    this.client_ = new Razorpay({
      key_id: options.keyId,
      key_secret: options.keySecret,
    })
  }

  async initiatePayment(
    input: InitiatePaymentInput
  ): Promise<InitiatePaymentOutput> {
    const { amount, currency_code, data } = input

    if (currency_code.toLowerCase() !== "inr") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Mercury's Razorpay provider only supports INR in this build (got "${currency_code}").`
      )
    }

    const amountPaise = toPaise(amount)
    const sessionId = data?.session_id as string | undefined

    let order
    try {
      order = await this.client_.orders.create({
        amount: amountPaise,
        // eslint-disable-next-line @medusajs/link-create-keys-modules-enum -- this is a Razorpay SDK request field, not a Medusa module-link key.
        currency: "INR",
        // The session id round-trips through Razorpay as the order's
        // receipt so a later webhook (which only carries the Razorpay
        // order/payment ids) can be matched back to the Medusa payment
        // session that created it - see getWebhookActionAndData below.
        receipt: sessionId,
        notes: sessionId ? { mercury_session_id: sessionId } : undefined,
      })
    } catch (error) {
      throw buildRazorpayError("Failed to create Razorpay order", error)
    }

    return {
      id: order.id,
      status: PaymentSessionStatus.PENDING,
      data: {
        id: order.id,
        razorpay_order_id: order.id,
        amount: amountPaise,
        currency: order.currency,
        key_id: this.options_.keyId,
      },
    }
  }

  /**
   * Used two ways: (a) by Mercury's own gateway tools, to attach and verify
   * the razorpay_payment_id/razorpay_signature the Buyer app's checkout
   * widget returned after the customer paid, and (b) by Medusa itself if a
   * cart's total genuinely changes after a session was created - which
   * Razorpay orders cannot be amended for, so that case fails loudly rather
   * than silently keeping a stale amount.
   */
  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const { data, amount } = input
    const incomingPaymentId = data?.razorpay_payment_id as string | undefined
    const incomingSignature = data?.razorpay_signature as string | undefined

    if (incomingPaymentId && incomingSignature) {
      const orderId = data?.razorpay_order_id as string | undefined
      if (!orderId) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "Cannot verify a Razorpay payment signature without the originating order id."
        )
      }

      const expectedSignature = crypto
        .createHmac("sha256", this.options_.keySecret)
        .update(`${orderId}|${incomingPaymentId}`)
        .digest("hex")

      if (expectedSignature !== incomingSignature) {
        throw new MedusaError(
          MedusaError.Types.UNAUTHORIZED,
          "Razorpay payment signature verification failed - refusing to trust this payment."
        )
      }

      return {
        status: PaymentSessionStatus.PENDING,
        data: {
          ...data,
          razorpay_payment_id: incomingPaymentId,
          razorpay_signature: incomingSignature,
        },
      }
    }

    const storedAmountPaise = data?.amount as number | undefined
    const requestedAmountPaise = toPaise(amount)
    if (
      storedAmountPaise !== undefined &&
      storedAmountPaise !== requestedAmountPaise
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "This cart's total changed after the Razorpay order was created, and Razorpay orders cannot be amended. Delete this payment session and create a new one to reflect the updated total."
      )
    }

    return { status: PaymentSessionStatus.PENDING, data }
  }

  async authorizePayment(
    input: AuthorizePaymentInput
  ): Promise<AuthorizePaymentOutput> {
    const data = input.data ?? {}
    const paymentId = data.razorpay_payment_id as string | undefined

    if (!paymentId) {
      // The customer has not completed the Razorpay checkout yet (or the
      // Buyer app has not yet attached the verified payment id via
      // updatePayment). This is a real, honest "not ready" - never
      // fabricated as authorized.
      return { status: PaymentSessionStatus.PENDING, data }
    }

    let payment
    try {
      payment = await this.client_.payments.fetch(paymentId)
    } catch (error) {
      throw buildRazorpayError(
        "Failed to verify Razorpay payment before authorization",
        error
      )
    }

    if (payment.order_id !== data.razorpay_order_id) {
      throw new MedusaError(
        MedusaError.Types.UNAUTHORIZED,
        "Razorpay payment does not belong to the order for this cart."
      )
    }

    const merged = {
      ...data,
      id: payment.id,
      razorpay_payment_status: payment.status,
    }

    switch (payment.status) {
      case "authorized":
      case "captured":
        return { status: PaymentSessionStatus.AUTHORIZED, data: merged }
      case "failed":
        return { status: PaymentSessionStatus.ERROR, data: merged }
      default:
        return { status: PaymentSessionStatus.PENDING, data: merged }
    }
  }

  async capturePayment(
    input: CapturePaymentInput
  ): Promise<CapturePaymentOutput> {
    const data = input.data ?? {}
    const paymentId = data.razorpay_payment_id as string | undefined
    if (!paymentId) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "No Razorpay payment id on this payment - cannot capture."
      )
    }

    try {
      const existing = await this.client_.payments.fetch(paymentId)
      if (existing.status === "captured") {
        // Razorpay auto-captures most payment methods by default; this is
        // a real confirmation of that state, not an assumption.
        return { data: { ...data, razorpay_payment_status: existing.status } }
      }

      const amountPaise = (data.amount as number | undefined) ?? toPaise(0)
      const captured = await this.client_.payments.capture(
        paymentId,
        amountPaise,
        "INR"
      )
      return { data: { ...data, razorpay_payment_status: captured.status } }
    } catch (error) {
      throw buildRazorpayError("Failed to capture Razorpay payment", error)
    }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    // Razorpay has no "void an order" API: an order with no successful
    // payment simply expires unused, and an authorized-but-uncaptured
    // payment is auto-released by Razorpay if never captured. There is
    // nothing real for Mercury to do here beyond reflecting current state.
    return { data: input.data }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return this.cancelPayment(input)
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const { amount, data } = input
    const paymentId = data?.razorpay_payment_id as string | undefined
    if (!paymentId) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "No Razorpay payment id on this payment - cannot refund."
      )
    }

    try {
      const refund = await this.client_.payments.refund(paymentId, {
        amount: toPaise(amount),
      })
      return { data: { ...data, last_refund_id: refund.id } }
    } catch (error) {
      throw buildRazorpayError("Failed to refund Razorpay payment", error)
    }
  }

  async retrievePayment(
    input: RetrievePaymentInput
  ): Promise<RetrievePaymentOutput> {
    const paymentId = input.data?.razorpay_payment_id as string | undefined
    if (!paymentId) {
      return { data: input.data ?? {} }
    }

    try {
      const payment = await this.client_.payments.fetch(paymentId)
      return {
        data: {
          ...input.data,
          razorpay_payment_status: payment.status,
        },
      }
    } catch (error) {
      throw buildRazorpayError("Failed to retrieve Razorpay payment", error)
    }
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput
  ): Promise<GetPaymentStatusOutput> {
    const data = input.data ?? {}
    const paymentId = data.razorpay_payment_id as string | undefined
    if (!paymentId) {
      return { status: PaymentSessionStatus.PENDING }
    }

    const payment = await this.client_.payments.fetch(paymentId)
    switch (payment.status) {
      case "captured":
        return { status: PaymentSessionStatus.CAPTURED }
      case "authorized":
        return { status: PaymentSessionStatus.AUTHORIZED }
      case "failed":
        return { status: PaymentSessionStatus.ERROR }
      case "refunded":
        return { status: PaymentSessionStatus.CANCELED }
      default:
        return { status: PaymentSessionStatus.PENDING }
    }
  }

  async getWebhookActionAndData(
    webhookData: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    const signature = webhookData.headers?.["x-razorpay-signature"] as
      | string
      | undefined

    if (!this.options_.webhookSecret || !signature) {
      return { action: PaymentActions.NOT_SUPPORTED }
    }

    const rawBody = webhookData.rawData
    const isValid = Razorpay.validateWebhookSignature(
      typeof rawBody === "string" ? rawBody : rawBody.toString(),
      signature,
      this.options_.webhookSecret
    )
    if (!isValid) {
      // A failed signature check must never be treated as a valid event -
      // this could otherwise be used to forge payment confirmations.
      return { action: PaymentActions.NOT_SUPPORTED }
    }

    const event = webhookData.data as {
      event?: string
      payload?: { payment?: { entity?: Record<string, unknown> } }
    }
    const paymentEntity = event.payload?.payment?.entity
    if (!paymentEntity) {
      return { action: PaymentActions.NOT_SUPPORTED }
    }

    // The Medusa payment session id was stashed as the Razorpay order's
    // receipt at creation time (see initiatePayment) - fetch the order to
    // recover it, since webhook payloads only carry Razorpay's own ids.
    let sessionId: string | undefined
    try {
      const order = await this.client_.orders.fetch(
        paymentEntity.order_id as string
      )
      sessionId = order.receipt as string | undefined
    } catch {
      sessionId = undefined
    }

    if (!sessionId) {
      return { action: PaymentActions.NOT_SUPPORTED }
    }

    const amount = fromPaise(Number(paymentEntity.amount ?? 0))

    switch (event.event) {
      case "payment.authorized":
        return {
          action: PaymentActions.AUTHORIZED,
          data: { session_id: sessionId, amount },
        }
      case "payment.captured":
        return {
          action: PaymentActions.SUCCESSFUL,
          data: { session_id: sessionId, amount },
        }
      case "payment.failed":
        return {
          action: PaymentActions.FAILED,
          data: { session_id: sessionId, amount },
        }
      default:
        return { action: PaymentActions.NOT_SUPPORTED }
    }
  }
}

export default RazorpayProviderService
