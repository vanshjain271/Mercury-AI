"use client"

import { useState, useTransition } from "react"
import type { ApprovalRequest } from "@/types"
import { formatDate } from "@/lib/format"
import { approveRequestAction, rejectRequestAction } from "@/actions/approvals"

export function ApprovalCard({ approval }: { approval: ApprovalRequest }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{approval.action_type}</p>
        <span className="text-xs text-muted">{formatDate(approval.created_at)}</span>
      </div>
      <p className="mt-1 text-sm text-muted">{approval.summary}</p>
      <pre className="mt-2 overflow-x-auto rounded-lg bg-background p-3 text-xs text-muted">
        {JSON.stringify(approval.payload, null, 2)}
      </pre>

      {approval.status === "pending" ? (
        <div className="mt-3 flex gap-2">
          <button
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await rejectRequestAction(approval.id)
                if (result.error) setError(result.error)
              })
            }
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-background"
          >
            Reject
          </button>
          <button
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await approveRequestAction(approval.id)
                if (result.error) setError(result.error)
              })
            }
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:opacity-90"
          >
            Approve &amp; execute
          </button>
        </div>
      ) : (
        <p className="mt-3 text-xs font-medium text-muted">Status: {approval.status}</p>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  )
}
