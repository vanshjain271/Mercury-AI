import { NextResponse } from "next/server"
import { getToken } from "@/lib/session"
import { merchantConfig } from "@/lib/config"

/**
 * Same-origin proxy for the Merchant chat widget. The Medusa admin JWT
 * lives only in an httpOnly cookie (see lib/session.ts) so client-side JS
 * can never read it - this route reads it server-side and forwards the
 * chat message to /admin/mercury/agent, keeping the credential out of the
 * browser entirely.
 */
export async function POST(request: Request) {
  const token = await getToken()
  if (!token) {
    return NextResponse.json({ message: "Not signed in." }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))

  const res = await fetch(`${merchantConfig.medusaBackendUrl}/admin/mercury/agent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message: body.message }),
  })

  const data = await res.json().catch(() => ({}))
  return NextResponse.json(data, { status: res.status })
}
