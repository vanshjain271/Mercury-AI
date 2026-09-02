import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ToolContext, ToolDefinition } from "../types"

// Prices are seeded (see src/scripts/seed-mercury.ts) as whole INR rupee
// amounts directly on variant.prices.amount - Mercury never sells in a
// second currency, so there is no minor-unit/major-unit ambiguity to
// resolve here.
const PRODUCT_FIELDS = [
  "id",
  "title",
  "subtitle",
  "description",
  "thumbnail",
  "status",
  "metadata",
  "categories.name",
  "variants.id",
  "variants.title",
  "variants.sku",
  "variants.prices.amount",
  "variants.prices.currency_code",
  "variants.inventory_items.inventory.location_levels.stocked_quantity",
  "variants.inventory_items.inventory.location_levels.reserved_quantity",
]

interface RawVariant {
  id: string
  title: string
  sku: string | null
  prices?: { amount: number; currency_code: string }[]
  inventory_items?: {
    inventory?: {
      location_levels?: { stocked_quantity: number; reserved_quantity: number }[]
    }
  }[]
}

interface RawProduct {
  id: string
  title: string
  subtitle: string | null
  description: string | null
  thumbnail: string | null
  status: string
  metadata: Record<string, unknown> | null
  categories?: { name: string }[]
  variants?: RawVariant[]
}

export interface CatalogFacts {
  product_id: string
  variant_id: string
  title: string
  subtitle: string | null
  description: string | null
  thumbnail: string | null
  category: string | null
  variant_title: string
  sku: string | null
  price_inr: number | null
  available_quantity: number
  in_stock: boolean
  rating: number | null
  features: string[]
}

function variantAvailability(variant: RawVariant): number {
  const items = variant.inventory_items ?? []
  if (items.length === 0) return Number.POSITIVE_INFINITY // not inventory-managed
  let total = 0
  for (const item of items) {
    for (const level of item.inventory?.location_levels ?? []) {
      total += (level.stocked_quantity ?? 0) - (level.reserved_quantity ?? 0)
    }
  }
  return total
}

function toFacts(product: RawProduct, variant: RawVariant): CatalogFacts {
  const inrPrice = variant.prices?.find((p) => p.currency_code === "inr")
  const available = variantAvailability(variant)
  const metadata = product.metadata ?? {}
  return {
    product_id: product.id,
    variant_id: variant.id,
    title: product.title,
    subtitle: product.subtitle,
    description: product.description,
    thumbnail: product.thumbnail,
    category: product.categories?.[0]?.name ?? null,
    variant_title: variant.title,
    sku: variant.sku,
    price_inr: inrPrice ? Math.round(inrPrice.amount) : null,
    available_quantity: Number.isFinite(available) ? available : 999,
    in_stock: available > 0,
    rating: typeof metadata.rating === "number" ? metadata.rating : null,
    features: Array.isArray(metadata.features) ? (metadata.features as string[]) : [],
  }
}

async function fetchPublishedCatalog(ctx: ToolContext): Promise<CatalogFacts[]> {
  const query = ctx.container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: products } = await query.graph({
    entity: "product",
    fields: PRODUCT_FIELDS,
    filters: { status: "published" },
  })

  const facts: CatalogFacts[] = []
  for (const product of products as RawProduct[]) {
    for (const variant of product.variants ?? []) {
      facts.push(toFacts(product, variant))
    }
  }
  return facts
}

function matchScore(item: CatalogFacts, terms: string[], features: string[]): number {
  const haystack = `${item.title} ${item.subtitle ?? ""} ${item.description ?? ""} ${item.category ?? ""} ${item.features.join(" ")}`.toLowerCase()
  let score = 0
  for (const term of terms) {
    if (haystack.includes(term.toLowerCase())) score += 2
  }
  for (const feature of features) {
    const matched = item.features.some((f) => f.toLowerCase().includes(feature.toLowerCase()))
    if (matched) score += 3
  }
  if (item.in_stock) score += 1.5
  if (item.rating != null) score += item.rating / 5
  return score
}

export const searchProductsTool: ToolDefinition = {
  name: "search_products",
  description:
    "Search Mercury's product catalog by free-text query, category, required features, and maximum budget in INR. Returns ranked, in-stock-aware candidates with database facts and computed match metrics (never invented data).",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Free-text search, e.g. 'wireless headphones'" },
      category: { type: "string", description: "Category name to filter by, e.g. 'Headphones'" },
      max_price_inr: { type: "number", description: "Maximum budget in whole INR rupees" },
      features: {
        type: "array",
        items: { type: "string" },
        description: "Required or desired features, e.g. ['ANC', 'long battery life']",
      },
      limit: { type: "number", description: "Max results to return (default 6)" },
    },
  },
  execute: async (input, ctx) => {
    const catalog = await fetchPublishedCatalog(ctx)
    const terms = [input.query, input.category].filter(Boolean) as string[]
    const features: string[] = input.features ?? []
    const limit = Math.min(Math.max(input.limit ?? 6, 1), 20)

    let candidates = catalog
    if (input.category) {
      candidates = candidates.filter(
        (c) => c.category?.toLowerCase() === String(input.category).toLowerCase()
      )
    }
    if (input.max_price_inr != null) {
      candidates = candidates.filter(
        (c) => c.price_inr != null && c.price_inr <= input.max_price_inr
      )
    }

    const ranked = candidates
      .map((c) => ({ item: c, score: matchScore(c, terms, features) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    return {
      count: ranked.length,
      results: ranked.map(({ item, score }) => ({
        facts: item,
        match: {
          score: Math.round(score * 100) / 100,
          matched_features: features.filter((f) =>
            item.features.some((pf) => pf.toLowerCase().includes(f.toLowerCase()))
          ),
          within_budget: input.max_price_inr == null ? null : (item.price_inr ?? Infinity) <= input.max_price_inr,
        },
      })),
    }
  },
}

export const getProductTool: ToolDefinition = {
  name: "get_product",
  description: "Get full details for a single product by its ID.",
  inputSchema: {
    type: "object",
    properties: { product_id: { type: "string" } },
    required: ["product_id"],
  },
  execute: async (input, ctx) => {
    const catalog = await fetchPublishedCatalog(ctx)
    const matches = catalog.filter((c) => c.product_id === input.product_id)
    if (matches.length === 0) {
      return { found: false }
    }
    return { found: true, variants: matches }
  },
}

export const compareProductsTool: ToolDefinition = {
  name: "compare_products",
  description: "Compare two or more products side by side using database facts.",
  inputSchema: {
    type: "object",
    properties: {
      product_ids: { type: "array", items: { type: "string" }, minItems: 2 },
    },
    required: ["product_ids"],
  },
  execute: async (input, ctx) => {
    const catalog = await fetchPublishedCatalog(ctx)
    const ids: string[] = input.product_ids
    const comparison = ids.map((id) => {
      const variants = catalog.filter((c) => c.product_id === id)
      return { product_id: id, variants }
    })
    return { comparison }
  },
}

export const getInventoryTool: ToolDefinition = {
  name: "get_inventory",
  description: "Get the available stock quantity for a specific product variant.",
  inputSchema: {
    type: "object",
    properties: { variant_id: { type: "string" } },
    required: ["variant_id"],
  },
  execute: async (input, ctx) => {
    const catalog = await fetchPublishedCatalog(ctx)
    const match = catalog.find((c) => c.variant_id === input.variant_id)
    if (!match) return { found: false }
    return {
      found: true,
      variant_id: match.variant_id,
      available_quantity: match.available_quantity,
      in_stock: match.in_stock,
    }
  },
}
