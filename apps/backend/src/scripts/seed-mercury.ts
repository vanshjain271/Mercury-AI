import { Client } from "pg"
import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  createApiKeysWorkflow,
  createCustomersWorkflow,
  createInventoryLevelsWorkflow,
  createOrderWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresStep,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"
import { MERCURY_MODULE } from "../modules/mercury"

/**
 * Mercury's demo dataset: one fictional, internally-consistent electronics
 * merchant. Every number the AI agents' tools ever report (revenue,
 * inventory, order history) is grounded in what this script actually
 * writes to the database - there is no separate "fake" layer the agents
 * read from. Run with:
 *
 *   pnpm run backend:seed
 *
 * Safe to re-run: each section checks for existing data first.
 */

const REGION_COUNTRY = "in"
const CURRENCY_CODE = "inr"

// A small, seeded PRNG (mulberry32) so re-running this script produces the
// exact same "random" order mix every time - useful for a demo where you
// want reproducible numbers to talk through, not different ones each run.
function mulberry32(seed: number) {
  let a = seed
  return function random() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260902)
function pick<T>(list: T[]): T {
  return list[Math.floor(rand() * list.length)]
}
function randInt(min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1))
}

// The historical-order loop below makes ~40-65 sequential DB round-trips in
// one run, which is long enough that a single dropped connection (a Neon
// serverless hiccup, a Wi-Fi blip - not anything this script controls) can
// abort the whole seed. Retrying just the one failed unit of work is safe
// (each iteration creates a brand new order) and far more robust than
// hoping the network behaves for the full run.
async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 3, delayMs = 2000): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt < attempts) {
        console.warn(
          `[mercury-seed] ${label} failed (attempt ${attempt}/${attempts}): ${(error as Error).message}. Retrying...`
        )
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }
  throw lastError
}

const updateStoreCurrencies = createWorkflow(
  "update-store-currencies",
  (input: { supported_currencies: { currency_code: string; is_default?: boolean }[]; store_id: string }) => {
    const normalizedInput = transform({ input }, (data) => ({
      selector: { id: data.input.store_id },
      update: {
        supported_currencies: data.input.supported_currencies.map((currency) => ({
          currency_code: currency.currency_code,
          is_default: currency.is_default ?? false,
        })),
      },
    }))
    const stores = updateStoresStep(normalizedInput)
    return new WorkflowResponse(stores)
  }
)

type ProductSpec = {
  key: string
  title: string
  category: string
  description: string
  rating: number
  features: string[]
  weight: number
  variants: { title: string; sku: string; priceInr: number; stock: number }[]
}

const CATEGORIES = [
  "Headphones",
  "Keyboards",
  "Chargers",
  "USB-C Cables",
  "Power Banks",
  "Webcams",
  "Accessories",
]

const PRODUCTS: ProductSpec[] = [
  {
    key: "soundwave-pro",
    title: "Mercury SoundWave Pro ANC",
    category: "Headphones",
    description:
      "Over-ear wireless headphones with active noise cancellation, a 40-hour battery, and Bluetooth 5.3 for a stable, low-latency connection.",
    rating: 4.5,
    features: ["Active Noise Cancellation", "40h battery life", "Bluetooth 5.3", "Fast charging (10 min = 5h)"],
    weight: 280,
    variants: [
      { title: "Black", sku: "MSW-PRO-BLK", priceInr: 4999, stock: 62 },
      { title: "Midnight Blue", sku: "MSW-PRO-BLU", priceInr: 4999, stock: 21 },
    ],
  },
  {
    key: "airbuds-lite",
    title: "Mercury AirBuds Lite",
    category: "Headphones",
    description: "True wireless earbuds with a 24-hour case battery, IPX5 water resistance, and touch controls.",
    rating: 4.1,
    features: ["Bluetooth 5.2", "IPX5 water resistant", "24h with case", "Touch controls"],
    weight: 45,
    variants: [
      { title: "White", sku: "MAB-LITE-WHT", priceInr: 1799, stock: 0 },
      { title: "Black", sku: "MAB-LITE-BLK", priceInr: 1799, stock: 88 },
    ],
  },
  {
    key: "studiofold-wired",
    title: "Mercury StudioFold Wired",
    category: "Headphones",
    description: "Foldable wired studio headphones with a detachable cable and both 3.5mm and 6.35mm connectors.",
    rating: 4.3,
    features: ["3.5mm + 6.35mm adapter", "Foldable design", "Detachable cable"],
    weight: 260,
    variants: [{ title: "Standard", sku: "MSF-WIRED-STD", priceInr: 2299, stock: 40 }],
  },
  {
    key: "typemech-87",
    title: "Mercury TypeMech 87 Mechanical Keyboard",
    category: "Keyboards",
    description: "An 87-key tenkeyless mechanical keyboard with hot-swappable switches and per-key RGB.",
    rating: 4.6,
    features: ["Hot-swappable switches", "RGB backlight", "87-key TKL layout", "USB-C detachable cable"],
    weight: 780,
    variants: [
      { title: "Red Switch", sku: "MTM-87-RED", priceInr: 5499, stock: 34 },
      { title: "Blue Switch", sku: "MTM-87-BLU", priceInr: 5499, stock: 4 },
    ],
  },
  {
    key: "flexboard-wireless",
    title: "Mercury FlexBoard Wireless Keyboard",
    category: "Keyboards",
    description: "A slim wireless keyboard that pairs over 2.4GHz or Bluetooth, with a rechargeable battery.",
    rating: 4.0,
    features: ["2.4GHz + Bluetooth", "Slim profile", "Rechargeable battery"],
    weight: 420,
    variants: [
      { title: "Black", sku: "MFB-WL-BLK", priceInr: 2199, stock: 51 },
      { title: "White", sku: "MFB-WL-WHT", priceInr: 2199, stock: 29 },
    ],
  },
  {
    key: "fastcharge-65w",
    title: "Mercury FastCharge 65W GaN Charger",
    category: "Chargers",
    description: "A compact 65W GaN charger with dual USB-C/USB-A ports for laptops, tablets, and phones.",
    rating: 4.4,
    features: ["65W USB-C PD", "GaN technology", "Dual port"],
    weight: 120,
    variants: [{ title: "Standard", sku: "MFC-65W-STD", priceInr: 1999, stock: 73 }],
  },
  {
    key: "fastcharge-20w",
    title: "Mercury FastCharge 20W USB-C Charger",
    category: "Chargers",
    description: "A pocket-sized 20W USB-C PD charger for everyday phone charging.",
    rating: 4.2,
    features: ["20W PD", "Compact design"],
    weight: 40,
    variants: [{ title: "Standard", sku: "MFC-20W-STD", priceInr: 799, stock: 140 }],
  },
  {
    key: "braidcable-cc",
    title: "Mercury BraidCable USB-C to USB-C (1m)",
    category: "USB-C Cables",
    description: "A braided nylon USB-C to USB-C cable rated for 100W PD charging and 480Mbps data.",
    rating: 4.3,
    features: ["100W PD support", "Braided nylon", "480Mbps data"],
    weight: 35,
    variants: [{ title: "1m", sku: "MBC-CC-1M", priceInr: 399, stock: 210 }],
  },
  {
    key: "braidcable-lightning",
    title: "Mercury BraidCable USB-C to Lightning (1m)",
    category: "USB-C Cables",
    description: "An MFi-certified braided USB-C to Lightning cable for fast charging.",
    rating: 4.1,
    features: ["MFi certified", "Fast charging", "Braided nylon"],
    weight: 35,
    variants: [{ title: "1m", sku: "MBC-LT-1M", priceInr: 499, stock: 6 }],
  },
  {
    key: "powercell-20000",
    title: "Mercury PowerCell 20000mAh",
    category: "Power Banks",
    description: "A high-capacity 20000mAh power bank with 22.5W fast charging over dual USB-A and USB-C.",
    rating: 4.4,
    features: ["20000mAh", "22.5W fast charging", "Dual USB-A + USB-C"],
    weight: 400,
    variants: [
      { title: "Black", sku: "MPC-20K-BLK", priceInr: 2499, stock: 47 },
      { title: "Grey", sku: "MPC-20K-GRY", priceInr: 2499, stock: 33 },
    ],
  },
  {
    key: "powercell-mini",
    title: "Mercury PowerCell Mini 10000mAh",
    category: "Power Banks",
    description: "A pocket-sized 10000mAh power bank with 18W PD output.",
    rating: 4.0,
    features: ["10000mAh", "Pocket-sized", "18W PD"],
    weight: 210,
    variants: [{ title: "Standard", sku: "MPC-MINI-STD", priceInr: 1299, stock: 58 }],
  },
  {
    key: "streamcam-1080p",
    title: "Mercury StreamCam 1080p",
    category: "Webcams",
    description: "A 1080p60 webcam with autofocus and a built-in noise-reducing microphone.",
    rating: 4.2,
    features: ["1080p 60fps", "Auto-focus", "Built-in mic"],
    weight: 90,
    variants: [{ title: "Standard", sku: "MSC-1080-STD", priceInr: 2999, stock: 26 }],
  },
  {
    key: "streamcam-4k-pro",
    title: "Mercury StreamCam 4K Pro",
    category: "Webcams",
    description: "A 4K30 HDR webcam with a physical privacy shutter and stereo microphones.",
    rating: 4.6,
    features: ["4K 30fps", "HDR", "Privacy shutter", "Stereo mic"],
    weight: 110,
    variants: [{ title: "Standard", sku: "MSC-4K-STD", priceInr: 5999, stock: 3 }],
  },
  {
    key: "deskmat-xl",
    title: "Mercury DeskMat XL",
    category: "Accessories",
    description: "A 900x400mm stitched-edge desk mat with a non-slip rubber base.",
    rating: 4.3,
    features: ["900x400mm", "Non-slip base", "Stitched edges"],
    weight: 650,
    variants: [{ title: "Standard", sku: "MDM-XL-STD", priceInr: 699, stock: 95 }],
  },
  {
    key: "laptopstand-aluminium",
    title: "Mercury LaptopStand Aluminium",
    category: "Accessories",
    description: "An adjustable, foldable aluminium laptop stand for ergonomic desk setups.",
    rating: 4.5,
    features: ["Aluminium build", "Adjustable height", "Foldable"],
    weight: 680,
    variants: [{ title: "Standard", sku: "MLS-ALU-STD", priceInr: 1499, stock: 44 }],
  },
  {
    key: "ergoclick-mouse",
    title: "Mercury WirelessMouse ErgoClick",
    category: "Accessories",
    description: "An ergonomic 2.4GHz wireless mouse with silent clicks.",
    rating: 4.1,
    features: ["Silent clicks", "2.4GHz wireless", "Ergonomic design"],
    weight: 95,
    variants: [
      { title: "Black", sku: "MWM-ERG-BLK", priceInr: 899, stock: 120 },
      { title: "White", sku: "MWM-ERG-WHT", priceInr: 899, stock: 0 },
    ],
  },
]

const CUSTOMERS = [
  { first_name: "Aarav", last_name: "Sharma", email: "aarav.sharma@example.com" },
  { first_name: "Priya", last_name: "Nair", email: "priya.nair@example.com" },
  { first_name: "Rohan", last_name: "Mehta", email: "rohan.mehta@example.com" },
  { first_name: "Ishita", last_name: "Verma", email: "ishita.verma@example.com" },
  { first_name: "Kabir", last_name: "Singh", email: "kabir.singh@example.com" },
  { first_name: "Ananya", last_name: "Iyer", email: "ananya.iyer@example.com" },
  { first_name: "Vivaan", last_name: "Gupta", email: "vivaan.gupta@example.com" },
  { first_name: "Diya", last_name: "Patel", email: "diya.patel@example.com" },
  { first_name: "Arjun", last_name: "Reddy", email: "arjun.reddy@example.com" },
  { first_name: "Sneha", last_name: "Joshi", email: "sneha.joshi@example.com" },
]

export default async function seedMercuryData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const storeModuleService = container.resolve(Modules.STORE)

  logger.info("[mercury-seed] Seeding store + sales channel...")
  const [store] = await storeModuleService.listStores()
  let [salesChannel] = await salesChannelModuleService.listSalesChannels({ name: "Mercury Store" })
  if (!salesChannel) {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: { salesChannelsData: [{ name: "Mercury Store" }] },
    })
    salesChannel = result[0]
  }

  await updateStoreCurrencies(container).run({
    input: {
      store_id: store.id,
      supported_currencies: [{ currency_code: CURRENCY_CODE, is_default: true }],
    },
  })
  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: { default_sales_channel_id: salesChannel.id },
    },
  })

  logger.info("[mercury-seed] Seeding region + tax region...")
  const { data: existingRegions } = await query.graph({
    entity: "region",
    fields: ["id", "currency_code"],
    filters: { currency_code: CURRENCY_CODE },
  })
  let region = (existingRegions as { id: string }[])[0]
  if (!region) {
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "India",
            currency_code: CURRENCY_CODE,
            countries: [REGION_COUNTRY],
            payment_providers: ["pp_razorpay_razorpay"],
          },
        ],
      },
    })
    region = result[0]
    await createTaxRegionsWorkflow(container).run({
      input: [{ country_code: REGION_COUNTRY, provider_id: "tp_system" }],
    })
  }

  logger.info("[mercury-seed] Seeding stock location + fulfillment...")
  const { data: existingLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
    filters: { name: "Mercury Warehouse - Bengaluru" },
  })
  let stockLocation = (existingLocations as { id: string }[])[0]
  let shippingOptionsExist = false
  if (!stockLocation) {
    const { result } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: "Mercury Warehouse - Bengaluru",
            address: {
              city: "Bengaluru",
              province: "KA",
              country_code: "IN",
              address_1: "Electronic City Phase 1",
              postal_code: "560100",
            },
          },
        ],
      },
    })
    stockLocation = result[0]

    await updateStoresWorkflow(container).run({
      input: { selector: { id: store.id }, update: { default_location_id: stockLocation.id } },
    })

    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
    })

    const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({ type: "default" })
    let shippingProfile = shippingProfiles[0]
    if (!shippingProfile) {
      const { result: profileResult } = await createShippingProfilesWorkflow(container).run({
        input: { data: [{ name: "Default Shipping Profile", type: "default" }] },
      })
      shippingProfile = profileResult[0]
    }

    const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
      name: "Mercury India Delivery",
      type: "shipping",
      service_zones: [
        { name: "India", geo_zones: [{ country_code: REGION_COUNTRY, type: "country" }] },
      ],
    })

    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
    })

    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: "Standard Delivery",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: fulfillmentSet.service_zones[0].id,
          shipping_profile_id: shippingProfile.id,
          type: { label: "Standard", description: "Delivered in 3-5 business days.", code: "standard" },
          prices: [
            { currency_code: CURRENCY_CODE, amount: 49 },
            { region_id: region.id, amount: 49 },
          ],
          rules: [
            { attribute: "enabled_in_store", value: "true", operator: "eq" },
            { attribute: "is_return", value: "false", operator: "eq" },
          ],
        },
      ],
    })
    shippingOptionsExist = true

    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: stockLocation.id, add: [salesChannel.id] },
    })
  } else {
    const { data: options } = await query.graph({ entity: "shipping_option", fields: ["id"] })
    shippingOptionsExist = (options as unknown[]).length > 0
  }
  if (!shippingOptionsExist) {
    logger.warn(
      "[mercury-seed] No shipping option found even though a stock location already existed - checkout will fail until one is created."
    )
  }

  logger.info("[mercury-seed] Seeding publishable API key...")
  const { data: existingKeys } = await query.graph({
    entity: "api_key",
    fields: ["id", "token"],
    filters: { type: "publishable" },
  })
  let publishableApiKey = (existingKeys as { id: string; token: string }[])[0]
  if (!publishableApiKey) {
    const {
      result: [created],
    } = await createApiKeysWorkflow(container).run({
      input: { api_keys: [{ title: "Mercury Buyer App", type: "publishable", created_by: "" }] },
    })
    publishableApiKey = created
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: { id: publishableApiKey.id, add: [salesChannel.id] },
    })
  }

  logger.info("[mercury-seed] Seeding product categories...")
  const { data: existingCategories } = await query.graph({
    entity: "product_category",
    fields: ["id", "name"],
  })
  const categoryByName = new Map<string, string>(
    (existingCategories as { id: string; name: string }[]).map((c) => [c.name, c.id])
  )
  const missingCategories = CATEGORIES.filter((name) => !categoryByName.has(name))
  if (missingCategories.length > 0) {
    const { result } = await createProductCategoriesWorkflow(container).run({
      input: { product_categories: missingCategories.map((name) => ({ name, is_active: true })) },
    })
    for (const category of result) {
      categoryByName.set(category.name, category.id)
    }
  }

  logger.info("[mercury-seed] Seeding products...")
  const { data: existingProducts } = await query.graph({ entity: "product", fields: ["id", "handle"] })
  const existingHandles = new Set((existingProducts as { handle: string }[]).map((p) => p.handle))
  const productsToCreate = PRODUCTS.filter((p) => !existingHandles.has(p.key))

  if (productsToCreate.length > 0) {
    await createProductsWorkflow(container).run({
      input: {
        products: productsToCreate.map((product) => ({
          title: product.title,
          handle: product.key,
          category_ids: [categoryByName.get(product.category)!],
          description: product.description,
          weight: product.weight,
          status: ProductStatus.PUBLISHED,
          thumbnail: `https://placehold.co/600x600/1a1a2e/ffffff?text=${encodeURIComponent(product.title)}`,
          metadata: { rating: product.rating, features: product.features },
          options: [{ title: "Variant", values: product.variants.map((v) => v.title) }],
          variants: product.variants.map((variant) => ({
            title: variant.title,
            sku: variant.sku,
            options: { Variant: variant.title },
            prices: [{ amount: variant.priceInr, currency_code: CURRENCY_CODE }],
          })),
          sales_channels: [{ id: salesChannel.id }],
        })),
      },
    })
  }
  logger.info(`[mercury-seed] ${productsToCreate.length} new product(s) created (${PRODUCTS.length - productsToCreate.length} already existed).`)

  logger.info("[mercury-seed] Seeding inventory levels...")
  const { data: variantsForInventory } = await query.graph({
    entity: "product_variant",
    fields: ["id", "sku", "inventory_items.inventory_item_id"],
  })
  const stockBySku = new Map<string, number>()
  for (const product of PRODUCTS) {
    for (const variant of product.variants) {
      stockBySku.set(variant.sku, variant.stock)
    }
  }
  const inventoryLevels: { location_id: string; stocked_quantity: number; inventory_item_id: string }[] = []
  for (const variant of variantsForInventory as { sku: string | null; inventory_items?: { inventory_item_id: string }[] }[]) {
    if (!variant.sku || !stockBySku.has(variant.sku)) continue
    for (const item of variant.inventory_items ?? []) {
      inventoryLevels.push({
        location_id: stockLocation.id,
        stocked_quantity: stockBySku.get(variant.sku)!,
        inventory_item_id: item.inventory_item_id,
      })
    }
  }
  // Historical orders below are real createOrderWorkflow calls, which check
  // and reserve actual inventory - so variants we *want* to end up low/out
  // of stock (for the inventory-risk opportunities demo) would make random
  // historical order generation fail the moment one was picked. Seed with a
  // generous buffer first, generate the historical orders against that
  // buffer, then correct every level down to its real demo target below.
  const INVENTORY_SEED_BUFFER = 500
  if (inventoryLevels.length > 0) {
    await createInventoryLevelsWorkflow(container).run({
      input: {
        inventory_levels: inventoryLevels.map((level) => ({
          ...level,
          stocked_quantity: Math.max(level.stocked_quantity, INVENTORY_SEED_BUFFER),
        })),
      },
    })
  }

  logger.info("[mercury-seed] Seeding customers...")
  const { data: existingCustomers } = await query.graph({
    entity: "customer",
    fields: ["id", "email"],
  })
  const customerByEmail = new Map<string, string>(
    (existingCustomers as { id: string; email: string }[]).map((c) => [c.email, c.id])
  )
  const customersToCreate = CUSTOMERS.filter((c) => !customerByEmail.has(c.email))
  if (customersToCreate.length > 0) {
    const { result } = await createCustomersWorkflow(container).run({
      input: { customersData: customersToCreate },
    })
    for (const customer of result) {
      customerByEmail.set(customer.email!, customer.id)
    }
  }

  logger.info("[mercury-seed] Seeding historical orders (this can take a minute)...")
  const { data: allVariants } = await query.graph({
    entity: "product_variant",
    fields: ["id", "title", "sku", "product.title"],
  })
  const variantsBySku = new Map(
    (allVariants as { id: string; title: string; sku: string | null; product: { title: string } }[])
      .filter((v) => v.sku)
      .map((v) => [v.sku as string, v])
  )
  const allSkus = PRODUCTS.flatMap((p) => p.variants.map((v) => v.sku))
  const customerEmails = [...customerByEmail.keys()]
  const priceBySkuForOrders = new Map(PRODUCTS.flatMap((p) => p.variants).map((v) => [v.sku, v.priceInr]))

  const { data: existingOrders } = await query.graph({ entity: "order", fields: ["id"] })
  const orderBackfillTargets: { id: string; daysAgo: number }[] = []

  if ((existingOrders as unknown[]).length === 0) {
    // A mild, believable upward trend: slightly more orders per day in the
    // most recent week than the week before it, so analyze_revenue has a
    // real (not exaggerated) growth story to report.
    const ordersPerDay: number[] = []
    for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
      ordersPerDay.push(daysAgo >= 7 ? randInt(2, 3) : randInt(3, 5))
    }

    let orderIndex = 0
    for (let dayOffset = 0; dayOffset < ordersPerDay.length; dayOffset++) {
      const daysAgo = 13 - dayOffset
      const count = ordersPerDay[dayOffset]
      for (let i = 0; i < count; i++) {
        const email = pick(customerEmails)
        const itemCount = randInt(1, 2)
        const chosenSkus = new Set<string>()
        while (chosenSkus.size < itemCount) chosenSkus.add(pick(allSkus))

        const items = [...chosenSkus].map((sku) => {
          const variant = variantsBySku.get(sku)!
          return {
            variant_id: variant.id,
            title: variant.product.title,
            variant_title: variant.title,
            quantity: randInt(1, 2),
            unit_price: priceBySkuForOrders.get(sku) ?? 0,
          }
        })

        const { result: order } = await withRetry(
          () =>
            createOrderWorkflow(container).run({
              input: {
                region_id: region.id,
                sales_channel_id: salesChannel.id,
                email,
                currency_code: CURRENCY_CODE,
                status: "completed",
                items,
                shipping_address: {
                  first_name: email.split(".")[0],
                  last_name: "Customer",
                  address_1: "MG Road",
                  city: "Bengaluru",
                  province: "KA",
                  postal_code: "560001",
                  country_code: REGION_COUNTRY,
                  phone: "9800000000",
                },
              },
            }),
          `create historical order ${orderIndex + 1}`
        )

        orderBackfillTargets.push({ id: order.id, daysAgo })
        orderIndex++
      }
    }
    logger.info(`[mercury-seed] Created ${orderIndex} historical orders.`)
  } else {
    logger.info("[mercury-seed] Orders already exist - skipping historical order generation.")
  }

  // Historical orders above were confirmed against the generous buffer
  // seeded earlier, not the real demo stock levels - correct every level
  // down to its intended target now, before anything (opportunities,
  // storefront) reads current stock.
  if (inventoryLevels.length > 0) {
    const inventoryModuleService = container.resolve(Modules.INVENTORY)
    await inventoryModuleService.updateInventoryLevels(inventoryLevels)
    logger.info(`[mercury-seed] Corrected ${inventoryLevels.length} inventory level(s) to their demo targets.`)
  }

  // Optional realism step: spread the orders just created across the last
  // two weeks so revenue analysis has a real week-over-week trend, instead
  // of every order landing on "today".
  //
  // Deliberate, scoped exception to this project's "no raw SQL / no direct
  // DB clients" convention: created_at is not part of Order's create or
  // update DTOs anywhere in Medusa core (it is stamped internally on
  // creation), so there is no module-service or workflow API that accepts a
  // backdated value. This is confined entirely to a one-off, offline demo
  // seed script - it is never imported by, or reachable from, any route,
  // workflow, or agent tool - and it only ever touches orders this same
  // script just created. If it fails for any reason, the rest of the seed
  // (which is what actually matters for the app to function) has already
  // succeeded, so this step is best-effort and never throws.
  if (orderBackfillTargets.length > 0 && process.env.DATABASE_URL) {
    const pgClient = new Client({ connectionString: process.env.DATABASE_URL })
    try {
      await pgClient.connect()
      let patched = 0
      for (const target of orderBackfillTargets) {
        const timestamp = new Date(Date.now() - target.daysAgo * 86400000 - randInt(0, 20) * 3600000)
        const result = await pgClient.query(
          'UPDATE "order" SET created_at = $1, updated_at = $1 WHERE id = $2',
          [timestamp, target.id]
        )
        if (result.rowCount) patched += result.rowCount
      }
      logger.info(`[mercury-seed] Backdated ${patched}/${orderBackfillTargets.length} order(s) for a realistic revenue trend.`)
    } catch (error) {
      logger.warn(
        `[mercury-seed] Could not backdate order timestamps (orders still exist and are valid, just all dated today): ${(error as Error).message}`
      )
    } finally {
      await pgClient.end().catch(() => undefined)
    }
  }

  logger.info("[mercury-seed] Seeding abandoned carts...")
  const { data: existingCarts } = await query.graph({ entity: "cart", fields: ["id"] })
  if ((existingCarts as unknown[]).length === 0) {
    const cartModuleService: any = container.resolve(Modules.CART)
    const abandonedSpecs = [
      { email: customerEmails[0], sku: "MTM-87-BLU", quantity: 1 },
      { email: customerEmails[2], sku: "MSC-4K-STD", quantity: 1 },
      { email: customerEmails[4], sku: "MSW-PRO-BLK", quantity: 1 },
      { email: customerEmails[6], sku: "MPC-20K-BLK", quantity: 2 },
      { email: customerEmails[8], sku: "MAB-LITE-BLK", quantity: 1 },
    ]
    for (const spec of abandonedSpecs) {
      const variant = variantsBySku.get(spec.sku)
      if (!variant) continue
      await cartModuleService.createCarts({
        currency_code: CURRENCY_CODE,
        region_id: region.id,
        sales_channel_id: salesChannel.id,
        email: spec.email,
        items: [
          {
            title: variant.product.title,
            variant_id: variant.id,
            quantity: spec.quantity,
            unit_price: PRODUCTS.flatMap((p) => p.variants).find((v) => v.sku === spec.sku)?.priceInr ?? 0,
          },
        ],
      })
    }
    logger.info(`[mercury-seed] Created ${abandonedSpecs.length} abandoned carts.`)
  } else {
    logger.info("[mercury-seed] Carts already exist - skipping abandoned cart generation.")
  }

  logger.info("[mercury-seed] Seeding Mercury Intelligence opportunities...")
  const mercuryService: any = container.resolve(MERCURY_MODULE)
  const existingOpportunities = await mercuryService.listOpportunities()
  if (existingOpportunities.length === 0) {
    const { data: lowStockVariants } = await query.graph({
      entity: "product_variant",
      fields: [
        "id",
        "title",
        "sku",
        "product.title",
        "inventory_items.inventory.location_levels.stocked_quantity",
      ],
    })
    const lowStock = (
      lowStockVariants as {
        title: string
        sku: string | null
        product: { title: string }
        inventory_items?: { inventory?: { location_levels?: { stocked_quantity: number }[] } }[]
      }[]
    )
      .map((v) => ({
        label: `${v.product.title} (${v.title})`,
        sku: v.sku,
        stocked:
          v.inventory_items?.[0]?.inventory?.location_levels?.reduce(
            (sum, level) => sum + (level.stocked_quantity ?? 0),
            0
          ) ?? 0,
      }))
      .filter((v) => v.stocked > 0 && v.stocked <= 6)

    const cartTotal = abandonedCartsTotal([
      { sku: "MTM-87-BLU", quantity: 1 },
      { sku: "MSC-4K-STD", quantity: 1 },
      { sku: "MSW-PRO-BLK", quantity: 1 },
      { sku: "MPC-20K-BLK", quantity: 2 },
      { sku: "MAB-LITE-BLK", quantity: 1 },
    ])

    await mercuryService.createOpportunities([
      {
        title: `${5} abandoned carts worth Rs ${cartTotal.toLocaleString("en-IN")} in the last few days`,
        category: "abandoned_cart",
        severity: cartTotal > 15000 ? "high" : "medium",
        estimated_impact_inr: cartTotal,
        confidence: 0.7,
        evidence: { cart_count: 5, total_value_inr: cartTotal },
        recommended_action:
          "Consider a limited-time discount campaign targeting these customers to recover the carts.",
        status: "new",
      },
      ...lowStock.slice(0, 3).map((item) => ({
        title: `${item.label} is low on stock (${item.stocked} left)`,
        category: "inventory_risk" as const,
        severity: item.stocked <= 3 ? "high" : ("medium" as const),
        estimated_impact_inr: null,
        confidence: 0.9,
        evidence: { sku: item.sku, stocked_quantity: item.stocked },
        recommended_action: "Reorder stock soon, or pause promotion of this variant until restocked.",
        status: "new",
      })),
      {
        title: "Headphones buyers frequently also need a USB-C cable or charger",
        category: "bundle",
        severity: "low",
        estimated_impact_inr: null,
        confidence: 0.55,
        evidence: { basis: "category co-occurrence in seeded order history" },
        recommended_action:
          "Propose a small bundle discount pairing a headphone SKU with a charger or cable to raise average order value.",
        status: "new",
      },
    ])
    logger.info("[mercury-seed] Opportunities seeded.")
  } else {
    logger.info("[mercury-seed] Opportunities already exist - skipping.")
  }

  logger.info("[mercury-seed] Mercury seed complete.")
  logger.info(
    `[mercury-seed] Buyer app publishable key (set as NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY in apps/buyer/.env.local): ${publishableApiKey.token}`
  )
}

function abandonedCartsTotal(items: { sku: string; quantity: number }[]): number {
  const priceBySku = new Map(PRODUCTS.flatMap((p) => p.variants).map((v) => [v.sku, v.priceInr]))
  return items.reduce((sum, item) => sum + (priceBySku.get(item.sku) ?? 0) * item.quantity, 0)
}
