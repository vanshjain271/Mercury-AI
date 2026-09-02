"use server"

import { revalidatePath } from "next/cache"
import { adminFetch } from "@/lib/admin-api"

export async function updatePolicyAction(
  toolName: string,
  patch: { allowed?: boolean; max_amount_inr?: number | null; requires_approval?: boolean }
): Promise<{ error?: string }> {
  try {
    await adminFetch("/admin/mercury/policies", {
      method: "POST",
      body: JSON.stringify({ tool_name: toolName, ...patch }),
    })
    revalidatePath("/policies")
    return {}
  } catch (error) {
    return { error: (error as Error).message }
  }
}
