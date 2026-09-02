import Link from "next/link"
import { adminFetch } from "@/lib/admin-api"
import { formatDate } from "@/lib/format"
import type { AuditEvent } from "@/types"

const PAGE_SIZE = 25

const EVENT_STYLE: Record<string, string> = {
  POLICY_BLOCKED: "bg-red-100 text-red-700",
  APPROVAL_REQUESTED: "bg-amber-100 text-amber-700",
  APPROVAL_GRANTED: "bg-emerald-100 text-emerald-700",
  APPROVAL_REJECTED: "bg-zinc-100 text-zinc-600",
  CAMPAIGN_APPROVED: "bg-emerald-100 text-emerald-700",
  CAMPAIGN_DISMISSED: "bg-zinc-100 text-zinc-600",
  POLICY_UPDATED: "bg-indigo-100 text-indigo-700",
  TOOL_NOT_FOUND: "bg-red-100 text-red-700",
}

function styleFor(eventType: string): string {
  const prefix = eventType.split(":")[0]
  if (prefix.startsWith("TOOL_ERROR")) return "bg-red-100 text-red-700"
  if (prefix.startsWith("TOOL_EXECUTED")) return "bg-emerald-100 text-emerald-700"
  return EVENT_STYLE[prefix] ?? "bg-zinc-100 text-zinc-600"
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string }>
}) {
  const { offset: offsetParam } = await searchParams
  const offset = Number(offsetParam) || 0

  const { events, count } = await adminFetch<{ events: AuditEvent[]; count: number }>(
    `/admin/mercury/audit?limit=${PAGE_SIZE}&offset=${offset}`
  )

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-foreground">Audit Center</h1>
      <p className="mt-1 text-sm text-muted">
        Every policy evaluation, agent action, approval decision, and checkout result Mercury has recorded - newest
        first, append-only.
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
        {events.map((event) => (
          <div key={event.id} className="border-b border-border p-4 last:border-b-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styleFor(event.event_type)}`}>
                {event.event_type}
              </span>
              <span className="text-xs text-muted">{event.actor}</span>
              <span className="ml-auto text-xs text-muted">{formatDate(event.created_at)}</span>
            </div>
            <p className="mt-1 text-sm text-foreground">{event.summary}</p>
          </div>
        ))}
        {events.length === 0 && <p className="p-4 text-sm text-muted">No audit events recorded yet.</p>}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted">
        <span>
          {Math.min(offset + 1, count)}-{Math.min(offset + PAGE_SIZE, count)} of {count}
        </span>
        <div className="flex gap-2">
          {offset > 0 && (
            <Link href={`/audit?offset=${Math.max(0, offset - PAGE_SIZE)}`} className="rounded-lg border border-border px-3 py-1.5 hover:bg-card">
              Newer
            </Link>
          )}
          {offset + PAGE_SIZE < count && (
            <Link href={`/audit?offset=${offset + PAGE_SIZE}`} className="rounded-lg border border-border px-3 py-1.5 hover:bg-card">
              Older
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
