"use client"

import { useState, useTransition } from "react"
import type { Policy } from "@/types"
import { updatePolicyAction } from "@/actions/policies"

export function PolicyRow({ policy }: { policy: Policy }) {
  const [maxAmount, setMaxAmount] = useState(policy.max_amount_inr?.toString() ?? "")
  const [requiresApproval, setRequiresApproval] = useState(policy.requires_approval)
  const [allowed, setAllowed] = useState(policy.allowed)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function save() {
    setSaved(false)
    setError(null)
    startTransition(async () => {
      const result = await updatePolicyAction(policy.tool_name, {
        allowed,
        requires_approval: requiresApproval,
        max_amount_inr: maxAmount.trim() === "" ? null : Number(maxAmount),
      })
      if (result.error) setError(result.error)
      else setSaved(true)
    })
  }

  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-foreground">{policy.tool_name}</p>
        <p className="text-xs text-muted">{policy.description}</p>
      </td>
      <td className="px-4 py-3">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allowed} onChange={(e) => setAllowed(e.target.checked)} />
          Allowed
        </label>
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          value={maxAmount}
          onChange={(e) => setMaxAmount(e.target.value)}
          placeholder="No limit"
          className="w-28 rounded-lg border border-border bg-background px-2 py-1 text-sm"
        />
      </td>
      <td className="px-4 py-3">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={requiresApproval} onChange={(e) => setRequiresApproval(e.target.checked)} />
          Requires approval
        </label>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          disabled={isPending}
          onClick={save}
          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
        {saved && <p className="mt-1 text-xs text-accent">Saved</p>}
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </td>
    </tr>
  )
}
