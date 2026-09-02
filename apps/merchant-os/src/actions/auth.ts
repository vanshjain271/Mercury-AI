"use server"

import { redirect } from "next/navigation"
import { setToken, clearToken } from "@/lib/session"
import { merchantConfig } from "@/lib/config"

export async function loginAction(
  _prevState: { error?: string } | undefined,
  formData: FormData
): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "")
  const password = String(formData.get("password") ?? "")

  if (!email || !password) return { error: "Email and password are required." }

  try {
    const res = await fetch(`${merchantConfig.medusaBackendUrl}/auth/user/emailpass`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    })
    const data = await res.json()

    if (!res.ok || !data.token) {
      return { error: data?.message ?? "Invalid email or password." }
    }

    await setToken(data.token)
  } catch {
    return { error: "Could not reach the Mercury backend." }
  }

  redirect("/")
}

export async function logoutAction(): Promise<void> {
  await clearToken()
  redirect("/login")
}
