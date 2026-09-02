"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import type { MercuryLineItem } from "@/types"
import { formatInr } from "@/lib/format"
import { updateLineItemAction, removeLineItemAction } from "@/actions/cart"

export function CartLineItemRow({ item }: { item: MercuryLineItem }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <div className="flex items-center gap-4 border-b border-border py-4">
      {item.thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element -- small cart thumbnail, not worth next/image's overhead here
        <img src={item.thumbnail} alt={item.title} className="h-16 w-16 rounded-lg object-cover" />
      )}
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{item.title}</p>
        {item.variant_title && <p className="text-xs text-muted">{item.variant_title}</p>}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border">
            <button
              className="px-2 py-1 text-sm"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await updateLineItemAction(item.id, Math.max(1, item.quantity - 1))
                  router.refresh()
                })
              }
            >
              -
            </button>
            <span className="w-6 text-center text-sm">{item.quantity}</span>
            <button
              className="px-2 py-1 text-sm"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await updateLineItemAction(item.id, item.quantity + 1)
                  router.refresh()
                })
              }
            >
              +
            </button>
          </div>
          <button
            className="text-xs text-muted underline hover:text-danger"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await removeLineItemAction(item.id)
                router.refresh()
              })
            }
          >
            Remove
          </button>
        </div>
      </div>
      <p className="text-sm font-semibold text-foreground">{formatInr(item.total)}</p>
    </div>
  )
}
