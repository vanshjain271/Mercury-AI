import { redirect } from "next/navigation"
import { getToken, clearToken } from "./session"
import { merchantConfig } from "./config"

export class AdminApiError extends Error {}

/**
 * Server-only fetch wrapper for Medusa's Admin API and Mercury's own
 * /admin/mercury/* routes, both protected by the same JWT from
 * POST /auth/user/emailpass (see actions/auth.ts). A 401 here means the
 * token is missing/expired, so this clears it and sends the user back to
 * the login page rather than surfacing a raw API error.
 */
export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken()
  if (!token) redirect("/login")

  const res = await fetch(`${merchantConfig.medusaBackendUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...init.headers,
    },
    cache: "no-store",
  })

  if (res.status === 401) {
    await clearToken()
    redirect("/login")
  }

  const text = await res.text()
  let json: unknown
  try {
    json = text ? JSON.parse(text) : undefined
  } catch {
    json = undefined
  }

  if (!res.ok) {
    const message = (json as { message?: string } | undefined)?.message ?? text ?? `Request failed (${res.status})`
    throw new AdminApiError(`${path} -> ${res.status}: ${message}`)
  }

  return json as T
}
