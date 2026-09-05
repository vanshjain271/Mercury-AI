import { Client } from "pg"

/**
 * Drops and recreates the "public" schema, wiping every table Medusa and
 * Mercury created - a clean slate to re-run `db:migrate` + `backend:seed`
 * from. Deliberate, scoped exception to this project's "no raw SQL / no
 * direct DB clients" convention, same as the backdating step in
 * seed-mercury.ts: this is a one-off, offline recovery script never
 * imported by, or reachable from, any route, workflow, or agent tool.
 *
 * Use this only to recover from a partially-seeded database (for example,
 * after a seed run crashed partway through) or to start the demo data over
 * from scratch. It deletes everything - there is no confirmation prompt.
 *
 * Run with:
 *   pnpm run db:reset          (drops + recreates the schema)
 *   pnpm exec medusa db:migrate
 *   pnpm exec medusa user -e admin@mercury.test -p supersecret
 *   pnpm run seed
 */
export default async function resetDb() {
  if (!process.env.DATABASE_URL) {
    console.error("[reset-db] DATABASE_URL is not set - refusing to run against an unknown database.")
    process.exit(1)
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
    console.log("[reset-db] Schema dropped and recreated. Run db:migrate next.")
  } finally {
    await client.end()
  }
}
