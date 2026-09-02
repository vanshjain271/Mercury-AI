import Image from "next/image"
import { notFound } from "next/navigation"
import { getProductByHandle } from "@/lib/medusa"
import { AddToCartForm } from "@/components/add-to-cart-form"

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params
  const product = await getProductByHandle(handle)
  if (!product) notFound()

  const features = product.metadata?.features ?? []

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid gap-10 md:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-brand-soft">
          {product.thumbnail && (
            <Image src={product.thumbnail} alt={product.title} fill className="object-cover" priority />
          )}
        </div>

        <div>
          {product.categories?.[0] && (
            <p className="text-sm font-medium uppercase tracking-wide text-brand">{product.categories[0].name}</p>
          )}
          <h1 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">{product.title}</h1>
          {product.metadata?.rating && <p className="mt-1 text-sm text-muted">★ {product.metadata.rating.toFixed(1)} rating</p>}
          {product.description && <p className="mt-4 text-muted">{product.description}</p>}

          {features.length > 0 && (
            <ul className="mt-4 space-y-1 text-sm text-foreground">
              {features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <span className="mt-1 text-brand">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-8">
            <AddToCartForm variants={product.variants} />
          </div>
        </div>
      </div>
    </div>
  )
}
