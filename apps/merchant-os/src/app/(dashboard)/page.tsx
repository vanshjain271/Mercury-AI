import Link from "next/link"
import { adminFetch } from "@/lib/admin-api"
import { formatInr } from "@/lib/format"
import type { RevenueAnalysis, Opportunity, ApprovalRequest, CampaignProposal } from "@/types"

export default async function OverviewPage() {
  const [revenue, opportunities, approvals, campaigns] = await Promise.all([
    adminFetch<RevenueAnalysis>("/admin/mercury/analytics/revenue?window_days=7"),
    adminFetch<{ opportunities: Opportunity[] }>("/admin/mercury/opportunities?limit=5"),
    adminFetch<{ approvals: ApprovalRequest[] }>("/admin/mercury/approvals?status=pending"),
    adminFetch<{ campaigns: CampaignProposal[] }>("/admin/mercury/campaigns"),
  ])

  const activeCampaigns = campaigns.campaigns.filter((c) => c.status === "active").length
  const changeLabel =
    revenue.revenue_change_pct === null
      ? "no prior data"
      : `${revenue.revenue_change_pct > 0 ? "+" : ""}${revenue.revenue_change_pct}% vs prior 7d`

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-foreground">Overview</h1>
      <p className="mt-1 text-sm text-muted">Last 7 days, grounded in real order data - nothing here is simulated.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue (7d)" value={formatInr(revenue.current.revenue_inr)} sub={changeLabel} />
        <StatCard label="Orders (7d)" value={String(revenue.current.order_count)} sub={`AOV ${formatInr(revenue.current.average_order_value_inr)}`} />
        <StatCard
          label="Pending approvals"
          value={String(approvals.approvals.length)}
          sub={approvals.approvals.length > 0 ? "Needs your review" : "All clear"}
          href="/approvals"
        />
        <StatCard label="Active campaigns" value={String(activeCampaigns)} sub={`${campaigns.campaigns.length} total proposed`} href="/campaigns" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Top products (7d)</h2>
          <ul className="mt-3 space-y-2">
            {revenue.top_products_by_revenue.map((p) => (
              <li key={p.title} className="flex justify-between text-sm">
                <span className="text-muted">{p.title}</span>
                <span className="font-medium text-foreground">{formatInr(p.revenue_inr)}</span>
              </li>
            ))}
            {revenue.top_products_by_revenue.length === 0 && (
              <li className="text-sm text-muted">No orders in this window yet.</li>
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Top opportunities</h2>
            <Link href="/opportunities" className="text-xs font-medium text-brand hover:underline">
              View all
            </Link>
          </div>
          <ul className="mt-3 space-y-3">
            {opportunities.opportunities.map((o) => (
              <li key={o.id} className="text-sm">
                <p className="font-medium text-foreground">{o.title}</p>
                <p className="text-xs text-muted">
                  {o.severity} severity{o.estimated_impact_inr ? ` · ~${formatInr(o.estimated_impact_inr)} impact` : ""}
                </p>
              </li>
            ))}
            {opportunities.opportunities.length === 0 && <li className="text-sm text-muted">Nothing detected yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, href }: { label: string; value: string; sub: string; href?: string }) {
  const content = (
    <div className="rounded-xl border border-border bg-card p-5 transition hover:border-brand">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted">{sub}</p>
    </div>
  )
  return href ? <Link href={href}>{content}</Link> : content
}
