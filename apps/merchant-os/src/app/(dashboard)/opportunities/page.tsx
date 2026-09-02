import { adminFetch } from "@/lib/admin-api"
import { formatInr } from "@/lib/format"
import type { Opportunity } from "@/types"

const SEVERITY_STYLE: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-zinc-100 text-zinc-600",
}

const CATEGORY_LABEL: Record<string, string> = {
  abandoned_cart: "Abandoned cart",
  upsell: "Upsell",
  cross_sell: "Cross-sell",
  inventory_risk: "Inventory risk",
  churn_signal: "Churn signal",
  bundle: "Bundle idea",
}

export default async function OpportunitiesPage() {
  const { opportunities } = await adminFetch<{ opportunities: Opportunity[] }>("/admin/mercury/opportunities?limit=50")

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-foreground">Opportunities</h1>
      <p className="mt-1 text-sm text-muted">
        Detected by Mercury Intelligence from real order, cart, and inventory data - nothing here is invented.
      </p>

      <div className="mt-6 space-y-3">
        {opportunities.map((o) => (
          <div key={o.id} className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLE[o.severity]}`}>
                {o.severity}
              </span>
              <span className="text-xs font-medium text-muted">{CATEGORY_LABEL[o.category] ?? o.category}</span>
              {o.confidence !== null && (
                <span className="text-xs text-muted">{Math.round(o.confidence * 100)}% confidence</span>
              )}
            </div>
            <p className="mt-2 text-sm font-medium text-foreground">{o.title}</p>
            {o.recommended_action && <p className="mt-1 text-sm text-muted">{o.recommended_action}</p>}
            <div className="mt-2 flex items-center gap-4 text-xs text-muted">
              {o.estimated_impact_inr !== null && <span>Est. impact {formatInr(o.estimated_impact_inr)}</span>}
              <span>Status: {o.status}</span>
            </div>
          </div>
        ))}
        {opportunities.length === 0 && (
          <p className="text-sm text-muted">No opportunities detected yet - run the seed script or wait for more order activity.</p>
        )}
      </div>
    </div>
  )
}
