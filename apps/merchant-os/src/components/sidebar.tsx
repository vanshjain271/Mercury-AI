import Link from "next/link"
import { logoutAction } from "@/actions/auth"

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/approvals", label: "Approvals" },
  { href: "/policies", label: "Policy Engine" },
  { href: "/audit", label: "Audit Center" },
]

export function Sidebar() {
  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-5">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-brand-foreground">
          M
        </span>
        <div>
          <p className="text-sm font-semibold leading-none">Mercury OS</p>
          <p className="text-xs text-muted">Merchant control</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="block rounded-lg px-3 py-2 text-sm font-medium text-muted hover:bg-brand-soft hover:text-brand"
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <form action={logoutAction} className="border-t border-border p-3">
        <button type="submit" className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-brand-soft">
          Sign out
        </button>
      </form>
    </aside>
  )
}
