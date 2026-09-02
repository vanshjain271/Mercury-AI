import { adminFetch } from "@/lib/admin-api"
import { ApprovalCard } from "@/components/approval-card"
import type { ApprovalRequest } from "@/types"

export default async function ApprovalsPage() {
  const { approvals } = await adminFetch<{ approvals: ApprovalRequest[] }>("/admin/mercury/approvals?status=pending")

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-foreground">Approvals</h1>
      <p className="mt-1 text-sm text-muted">
        Agent tool calls the Policy Engine deferred - over a spend limit, or a sensitive action it can never take
        alone. Approving here runs the exact same gateway code the agent would have used; the decision is yours.
      </p>

      <div className="mt-6 space-y-4">
        {approvals.map((approval) => (
          <ApprovalCard key={approval.id} approval={approval} />
        ))}
        {approvals.length === 0 && <p className="text-sm text-muted">Nothing waiting on you right now.</p>}
      </div>
    </div>
  )
}
