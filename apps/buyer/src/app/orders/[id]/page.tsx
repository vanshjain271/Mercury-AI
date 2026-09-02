import Link from "next/link"
import { notFound } from "next/navigation"
import { getOrder } from "@/lib/medusa"
import { formatInr } from "@/lib/format"

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const order = await getOrder(id)
  if (!order) notFound()

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand">Order confirmed</p>
      <h1 className="mt-2 text-2xl font-bold text-foreground">Thank you - order #{order.display_id}</h1>
      <p className="mt-2 text-muted">A confirmation has been recorded for {order.email}. Status: {order.status}.</p>

      <div className="mt-8 rounded-xl border border-border bg-card p-5 text-left">
        <ul className="space-y-2 text-sm text-muted">
          {order.items.map((item, index) => (
            <li key={index} className="flex justify-between">
              <span>
                {item.title} × {item.quantity}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-border pt-4 text-base font-semibold text-foreground">
          <span>Total</span>
          <span>{formatInr(order.total)}</span>
        </div>
      </div>

      <Link href="/products" className="mt-8 inline-block rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground">
        Continue shopping
      </Link>
    </div>
  )
}
