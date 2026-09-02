import Link from "next/link"
import { listProducts, listCategories } from "@/lib/medusa"
import { ProductCard } from "@/components/product-card"

export default async function HomePage() {
  const [products, categories] = await Promise.all([listProducts(), listCategories()])
  const featured = products.slice(0, 8)

  return (
    <div>
      <section className="border-b border-border bg-brand-soft">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">Mercury Electronics</p>
          <h1 className="mt-2 max-w-xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Shop with an assistant that actually knows the store.
          </h1>
          <p className="mt-4 max-w-xl text-muted">
            Browse like any store, or ask the Mercury assistant in the corner to find, compare, and check out for
            you - it can only act within limits your merchant sets, and it never fakes a payment.
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href="/products"
              className="rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground hover:opacity-90"
            >
              Browse the catalog
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/products?category=${encodeURIComponent(category.name)}`}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:border-brand hover:text-brand"
            >
              {category.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <h2 className="mb-6 text-lg font-semibold text-foreground">Featured products</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  )
}
