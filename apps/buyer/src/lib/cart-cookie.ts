import { cookies } from "next/headers"

// A guest cart id, persisted in a plain (non-httpOnly) cookie so both server
// actions and the client-side chat widget can read it. There is no secret
// in a Medusa cart id - anyone who could read this cookie already has
// access to the browser it belongs to - so this mirrors how Medusa's own
// Next.js storefront starter persists the cart id.
const CART_COOKIE = "mercury_cart_id"

export async function getCartId(): Promise<string | null> {
  const store = await cookies()
  return store.get(CART_COOKIE)?.value ?? null
}

export async function setCartId(cartId: string): Promise<void> {
  const store = await cookies()
  store.set(CART_COOKIE, cartId, {
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
  })
}

export async function clearCartId(): Promise<void> {
  const store = await cookies()
  store.delete(CART_COOKIE)
}
