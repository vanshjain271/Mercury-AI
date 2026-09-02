import { adminFetch } from "@/lib/admin-api"
import { CampaignCard } from "@/components/campaign-card"
import type { CampaignProposal } from "@/types"

export default async function CampaignsPage() {
  const { campaigns } = await adminFetch<{ campaigns: CampaignProposal[] }>("/admin/mercury/campaigns")

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-foreground">Campaigns</h1>
      <p className="mt-1 text-sm text-muted">
        Drafted by the Merchant AI assistant from real audience/order data. Nothing goes live until you approve it here -
        the agent is hard-blocked from approving its own proposals.
      </p>

      <div className="mt-6 space-y-4">
        {campaigns.map((campaign) => (
          <CampaignCard key={campaign.id} campaign={campaign} />
        ))}
        {campaigns.length === 0 && (
          <p className="text-sm text-muted">
            No campaigns yet - ask the Merchant assistant to draft one from the chat widget.
          </p>
        )}
      </div>
    </div>
  )
}
