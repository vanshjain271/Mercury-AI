"use server"

import { revalidatePath } from "next/cache"
import { adminFetch } from "@/lib/admin-api"

export async function approveCampaignAction(campaignId: string): Promise<{ error?: string }> {
  try {
    await adminFetch(`/admin/mercury/campaigns/${campaignId}/approve`, { method: "POST" })
    revalidatePath("/campaigns")
    revalidatePath("/")
    return {}
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function dismissCampaignAction(campaignId: string): Promise<{ error?: string }> {
  try {
    await adminFetch(`/admin/mercury/campaigns/${campaignId}/dismiss`, { method: "POST" })
    revalidatePath("/campaigns")
    return {}
  } catch (error) {
    return { error: (error as Error).message }
  }
}
