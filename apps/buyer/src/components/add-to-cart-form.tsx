"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { MercuryProductVariant } from "@/types"
import { formatInr } from "@/lib/format"
import { addToCartAction } from "@/actions/cart"

export function AddToCartForm({ variants }: { variants: MercuryProductVariant[] }) {
  const [selectedId, setSelectedId] = useState(variants[0]?.id ?? "")
  const [quantity, setQuantity] = useState(1)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const selected = variants.find((v) => v.id === selectedId) ?? variants[0]
  const stock = selected?.inventory_quantity ?? 0
  const outOfStock = stock <= 0

  return (
    <div className="flex flex-col gap-4">
      {variants.length > 1 && (
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">Variant</label>
          <div className="flex flex-wrap gap-2">
            {variants.map((variant) => (
              <button
                key={variant.id}
                type="button"
                onClick={() => setSelectedId(variant.id)}
                disabled={(variant.inventory_quantity ?? 0) <= 0}
                className={`rounded-full border px-3 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  variant.id === selectedId
                    ? "border-brand bg-brand-soft text-brand"
                    : "border-border text-foreground hover:border-brand"
                }`}
              >
                {variant.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-foreground">Qty</label>
        <div className="flex items-center rounded-lg border border-border">
          <button
            type="button"
            className="px-3 py-1.5 text-lg"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          >
            -
          </button>
          <span className="w-8 text-center text-sm">{quantity}</span>
          <button
            type="button"
            className="px-3 py-1.5 text-lg"
            onClick={() => setQuantity((q) => Math.min(stock || 1, q + 1))}
          >
            +
          </button>
        </div>
        {selected && (
          <span className="text-sm text-muted">
            {outOfStock ? "Out of stock" : stock <= 6 ? `Only ${stock} left` : "In stock"}
          </span>
        )}
      </div>

      <button
        type="button"
        disabled={outOfStock || isPending || !selected}
        onClick={() => {
          setMessage(null)
          startTransition(async () => {
            const result = await addToCartAction(selected!.id, quantity)
            if (result.error) {
              setMessage(result.error)
            } else {
              setMessage("Added to cart.")
              router.refresh()
            }
          })
        }}
        className="w-full rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {outOfStock ? "Out of stock" : isPending ? "Adding..." : `Add to cart - ${formatInr(selected?.calculated_price?.calculated_amount)}`}
      </button>

      {message && <p className="text-sm text-muted">{message}</p>}
    </div>
  )
}
