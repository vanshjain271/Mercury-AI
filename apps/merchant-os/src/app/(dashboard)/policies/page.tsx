import { adminFetch } from "@/lib/admin-api"
import { PolicyRow } from "@/components/policy-row"
import type { Policy } from "@/types"

export default async function PoliciesPage() {
  const { policies } = await adminFetch<{ policies: Policy[] }>("/admin/mercury/policies")

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-foreground">Policy Engine</h1>
      <p className="mt-1 text-sm text-muted">
        Authority ceilings for every tool the Agent Gateway exposes to the AI. This is real application logic - the
        model is never trusted to enforce its own limits, and every evaluation is recorded to the Audit Center.
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left">
          <thead className="border-b border-border bg-background text-xs font-medium uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Tool</th>
              <th className="px-4 py-3">Enabled</th>
              <th className="px-4 py-3">Max amount (INR)</th>
              <th className="px-4 py-3">Approval</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {policies.map((policy) => (
              <PolicyRow key={policy.tool_name} policy={policy} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
