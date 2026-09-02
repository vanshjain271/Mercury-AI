import Link from "next/link"
import { getCartId } from "@/lib/cart-cookie"
import * as medusa from "@/lib/medusa"

export async function Header() {
  const cartId = await getCartId()
  let itemCount = 0
  if (cartId) {
    try {
      const cart = await medusa.getCart(cartId)
      itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0)
    } catch {
      itemCount = 0
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            M
          </span>
          Mercury
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-muted sm:flex">
          <Link href="/products" className="hover:text-foreground">
            Shop
          </Link>
          <Link href="/products?category=Headphones" className="hover:text-foreground">
            Headphones
          </Link>
          <Link href="/products?category=Keyboards" className="hover:text-foreground">
            Keyboards
          </Link>
        </nav>

        <Link
          href="/cart"
          className="relative inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-brand-soft"
        >
          Cart
          {itemCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-xs font-semibold text-brand-foreground">
              {itemCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  )
}
