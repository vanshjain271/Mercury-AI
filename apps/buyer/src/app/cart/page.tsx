import Link from "next/link"
import { getCartId } from "@/lib/cart-cookie"
import { getCart } from "@/lib/medusa"
import { CartLineItemRow } from "@/components/cart-line-item-row"
import { formatInr } from "@/lib/format"

export default async function CartPage() {
  const cartId = await getCartId()
  const cart = cartId ? await getCart(cartId).catch(() => null) : null

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-xl font-semibold text-foreground">Your cart is empty</h1>
        <p className="mt-2 text-muted">Ask the Mercury assistant for a recommendation, or browse the catalog.</p>
        <Link
          href="/products"
          className="mt-6 inline-block rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground"
        >
          Browse products
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-xl font-semibold text-foreground">Your cart</h1>

      <div className="mt-6">
        {cart.items.map((item) => (
          <CartLineItemRow key={item.id} item={item} />
        ))}
      </div>

      <div className="mt-6 space-y-2 border-t border-border pt-4 text-sm">
        <div className="flex justify-between text-muted">
          <span>Subtotal</span>
          <span>{formatInr(cart.item_total)}</span>
        </div>
        <div className="flex justify-between text-muted">
          <span>Shipping</span>
          <span>{formatInr(cart.shipping_total)}</span>
        </div>
        <div className="flex justify-between text-muted">
          <span>Tax</span>
          <span>{formatInr(cart.tax_total)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold text-foreground">
          <span>Total</span>
          <span>{formatInr(cart.total)}</span>
        </div>
      </div>

      <Link
        href="/checkout"
        className="mt-6 block w-full rounded-lg bg-brand px-6 py-3 text-center text-sm font-semibold text-brand-foreground hover:opacity-90"
      >
        Checkout
      </Link>
    </div>
  )
}
