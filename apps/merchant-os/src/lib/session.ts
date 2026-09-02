import { cookies } from "next/headers"

// The Medusa admin JWT from POST /auth/user/emailpass. httpOnly because,
// unlike the Buyer app's cart id, this is a real credential - only server
// components/actions/route handlers ever read it, never client JS.
const SESSION_COOKIE = "mercury_admin_token"

export async function getToken(): Promise<string | null> {
  const store = await cookies()
  return store.get(SESSION_COOKIE)?.value ?? null
}

export async function setToken(token: string): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // Medusa's own JWT expiry is the real limit; this just bounds the cookie.
  })
}

export async function clearToken(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}
