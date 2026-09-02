"use server"

import { revalidatePath } from "next/cache"
import { adminFetch } from "@/lib/admin-api"

export async function approveRequestAction(approvalId: string): Promise<{ error?: string }> {
  try {
    await adminFetch(`/admin/mercury/approvals/${approvalId}/approve`, { method: "POST" })
    revalidatePath("/approvals")
    revalidatePath("/")
    return {}
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function rejectRequestAction(approvalId: string): Promise<{ error?: string }> {
  try {
    await adminFetch(`/admin/mercury/approvals/${approvalId}/reject`, { method: "POST" })
    revalidatePath("/approvals")
    revalidatePath("/")
    return {}
  } catch (error) {
    return { error: (error as Error).message }
  }
}
