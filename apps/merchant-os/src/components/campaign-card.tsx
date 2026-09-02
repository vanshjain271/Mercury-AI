"use client"

import { useState, useTransition } from "react"
import type { CampaignProposal } from "@/types"
import { formatInr } from "@/lib/format"
import { approveCampaignAction, dismissCampaignAction } from "@/actions/campaigns"

const RISK_STYLE: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-emerald-100 text-emerald-700",
}

export function CampaignCard({ campaign }: { campaign: CampaignProposal }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const pendingReview = campaign.status === "proposed" || campaign.status === "draft"

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{campaign.name}</p>
          <p className="text-xs text-muted">{campaign.objective}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RISK_STYLE[campaign.risk]}`}>
          {campaign.risk} risk
        </span>
      </div>

      <p className="mt-3 text-sm text-muted">{campaign.strategy}</p>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted sm:grid-cols-4">
        <div>
          <dt>Audience</dt>
          <dd className="font-medium text-foreground">{campaign.estimated_audience ?? "-"}</dd>
        </div>
        <div>
          <dt>Discount</dt>
          <dd className="font-medium text-foreground">{campaign.discount_percent ? `${campaign.discount_percent}%` : "-"}</dd>
        </div>
        <div>
          <dt>Projected revenue</dt>
          <dd className="font-medium text-foreground">
            {formatInr(campaign.projected_revenue_low_inr)} - {formatInr(campaign.projected_revenue_high_inr)}
          </dd>
        </div>
        <div>
          <dt>Discount exposure</dt>
          <dd className="font-medium text-foreground">{formatInr(campaign.discount_exposure_inr)}</dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center gap-3">
        <span className="text-xs font-medium text-muted">Status: {campaign.status}</span>
        {pendingReview && (
          <div className="ml-auto flex gap-2">
            <button
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await dismissCampaignAction(campaign.id)
                  if (result.error) setError(result.error)
                })
              }
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-background"
            >
              Dismiss
            </button>
            <button
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await approveCampaignAction(campaign.id)
                  if (result.error) setError(result.error)
                })
              }
              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:opacity-90"
            >
              Approve &amp; activate
            </button>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  )
}
