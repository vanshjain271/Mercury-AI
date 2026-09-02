"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { initiateRazorpayPaymentAction } from "@/actions/checkout"
import { completeCheckout } from "@/lib/medusa"
import { formatInr } from "@/lib/format"

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void }
  }
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve()
    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Could not load Razorpay checkout."))
    document.body.appendChild(script)
  })
}

export function RazorpayCheckoutButton({ total }: { total: number }) {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handlePay() {
    if (!email.trim()) {
      setError("Enter an email address for the order confirmation.")
      return
    }
    setError(null)
    setStatus("loading")

    try {
      await loadRazorpayScript()
      const session = await initiateRazorpayPaymentAction(email.trim())

      if (session.error || !session.orderId || !session.keyId) {
        setError(session.error ?? "Could not start payment.")
        setStatus("error")
        return
      }

      const razorpay = new window.Razorpay({
        key: session.keyId,
        amount: session.amount,
        currency: session.currency,
        order_id: session.orderId,
        name: "Mercury",
        description: "Mercury order (test mode)",
        prefill: { email: session.customerEmail },
        theme: { color: "#6d28d9" },
        handler: async (response: {
          razorpay_payment_id: string
          razorpay_order_id: string
          razorpay_signature: string
        }) => {
          const result = await completeCheckout({
            cartId: session.cartId!,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          })

          if (result.success) {
            document.cookie = "mercury_cart_id=; path=/; max-age=0"
            router.push(`/orders/${result.order_id}`)
          } else {
            setError(
              `Payment was captured by Razorpay but Mercury could not verify and complete the order: ${JSON.stringify(
                result.error
              )}. Contact support with payment id ${response.razorpay_payment_id}.`
            )
            setStatus("error")
          }
        },
        modal: {
          ondismiss: () => setStatus("idle"),
        },
      })
      razorpay.open()
    } catch (err) {
      setError((err as Error).message)
      setStatus("error")
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-foreground">Email for order confirmation</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </div>

      <button
        onClick={handlePay}
        disabled={status === "loading"}
        className="w-full rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        {status === "loading" ? "Opening Razorpay..." : `Pay ${formatInr(total)} with Razorpay (test mode)`}
      </button>

      {error && <p className="text-sm text-danger">{error}</p>}
      <p className="text-xs text-muted">
        Test mode only - use Razorpay&rsquo;s published test card/UPI credentials. No real money moves.
      </p>
    </div>
  )
}
