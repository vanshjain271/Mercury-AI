import Link from "next/link"
import { listProducts, listCategories } from "@/lib/medusa"
import { ProductCard } from "@/components/product-card"

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category } = await searchParams
  const categories = await listCategories()
  const activeCategory = category ? categories.find((c) => c.name === category) : undefined
  const products = await listProducts({ categoryId: activeCategory?.id })

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-foreground">{activeCategory ? activeCategory.name : "All products"}</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/products"
          className={`rounded-full border px-4 py-2 text-sm font-medium ${
            !activeCategory ? "border-brand bg-brand-soft text-brand" : "border-border text-foreground hover:border-brand"
          }`}
        >
          All
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/products?category=${encodeURIComponent(c.name)}`}
            className={`rounded-full border px-4 py-2 text-sm font-medium ${
              activeCategory?.id === c.id
                ? "border-brand bg-brand-soft text-brand"
                : "border-border text-foreground hover:border-brand"
            }`}
          >
            {c.name}
          </Link>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
        {products.length === 0 && <p className="col-span-full text-muted">No products in this category yet.</p>}
      </div>
    </div>
  )
}
