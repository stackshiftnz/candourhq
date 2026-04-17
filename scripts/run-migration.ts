/**
 * Migration runner for Candour HQ.
 * Uses a direct Postgres connection to apply 001_initial_schema.sql.
 *
 * Usage:
 *   npx tsx scripts/run-migration.ts
 *
 * Requires DATABASE_URL in .env.local:
 *   DATABASE_URL=postgresql://postgres:[password]@db.vaxusrobbxkbswezjvjv.supabase.co:5432/postgres
 *
 * Get your password: Supabase dashboard → Settings → Database → Connection string (URI mode)
 */

import { Client } from 'pg'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('❌ DATABASE_URL not set in .env.local')
  console.error('   Add: DATABASE_URL=postgresql://postgres:[password]@db.vaxusrobbxkbswezjvjv.supabase.co:5432/postgres')
  process.exit(1)
}

const sqlPath = path.resolve(process.cwd(), '../_context/migrations/001_initial_schema.sql')
const sql = fs.readFileSync(sqlPath, 'utf-8')

async function main() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  })

  console.log('🔌 Connecting to database...')
  await client.connect()
  console.log('✅ Connected')

  console.log('📦 Running 001_initial_schema.sql...')
  try {
    await client.query(sql)
    console.log('✅ Migration applied successfully')
  } catch (err) {
    console.error('❌ Migration failed:', (err as Error).message)
    await client.end()
    process.exit(1)
  }

  await client.end()
  console.log('🔌 Connection closed')
  console.log('\nNext: run  npx tsx scripts/verify-schema.ts  to verify all tables and triggers.')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
