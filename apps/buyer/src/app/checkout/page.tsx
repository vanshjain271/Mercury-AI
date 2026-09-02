import { redirect } from "next/navigation"
import { getCartId } from "@/lib/cart-cookie"
import { getCart } from "@/lib/medusa"
import { RazorpayCheckoutButton } from "@/components/razorpay-checkout-button"
import { formatInr } from "@/lib/format"

export default async function CheckoutPage() {
  const cartId = await getCartId()
  const cart = cartId ? await getCart(cartId).catch(() => null) : null

  if (!cart || cart.items.length === 0) {
    redirect("/cart")
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="text-xl font-semibold text-foreground">Checkout</h1>

      <div className="mt-6 rounded-xl border border-border bg-card p-5">
        <ul className="space-y-2 text-sm">
          {cart.items.map((item) => (
            <li key={item.id} className="flex justify-between text-muted">
              <span>
                {item.title} × {item.quantity}
              </span>
              <span className="text-foreground">{formatInr(item.total)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-border pt-4 text-base font-semibold text-foreground">
          <span>Total</span>
          <span>{formatInr(cart.total)}</span>
        </div>
      </div>

      <div className="mt-6">
        <RazorpayCheckoutButton total={cart.total} />
      </div>
    </div>
  )
}
