import Image from "next/image"
import Link from "next/link"
import type { MercuryProduct } from "@/types"
import { formatInr } from "@/lib/format"

function priceRangeFor(product: MercuryProduct): { min: number; max: number } {
  const prices = product.variants
    .map((v) => v.calculated_price?.calculated_amount)
    .filter((p): p is number => typeof p === "number")
  if (prices.length === 0) return { min: 0, max: 0 }
  return { min: Math.min(...prices), max: Math.max(...prices) }
}

function totalStock(product: MercuryProduct): number {
  return product.variants.reduce((sum, v) => sum + (v.inventory_quantity ?? 0), 0)
}

export function ProductCard({ product }: { product: MercuryProduct }) {
  const { min, max } = priceRangeFor(product)
  const stock = totalStock(product)
  const rating = product.metadata?.rating

  return (
    <Link
      href={`/products/${product.handle}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition hover:shadow-md"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-brand-soft">
        {product.thumbnail && (
          <Image
            src={product.thumbnail}
            alt={product.title}
            fill
            sizes="(min-width: 768px) 25vw, 50vw"
            className="object-cover transition group-hover:scale-105"
          />
        )}
        {stock === 0 && (
          <span className="absolute left-2 top-2 rounded-full bg-zinc-900/80 px-2 py-1 text-xs font-medium text-white">
            Out of stock
          </span>
        )}
        {stock > 0 && stock <= 6 && (
          <span className="absolute left-2 top-2 rounded-full bg-amber-500/90 px-2 py-1 text-xs font-medium text-white">
            Only {stock} left
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-sm font-medium text-foreground">{product.title}</p>
        {rating && <p className="text-xs text-muted">★ {rating.toFixed(1)}</p>}
        <p className="mt-auto pt-2 text-sm font-semibold text-foreground">
          {min === max ? formatInr(min) : `${formatInr(min)} - ${formatInr(max)}`}
        </p>
      </div>
    </Link>
  )
}
