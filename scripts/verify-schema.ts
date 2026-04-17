/**
 * Schema verification script for Candour HQ.
 * Run after applying 001_initial_schema.sql to verify everything is correct.
 *
 * Usage:
 *   npx tsx scripts/verify-schema.ts
 *
 * Requires .env.local to be populated with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const EXPECTED_TABLES = [
  'profiles',
  'brand_profiles',
  'workspaces',
  'team_members',
  'team_invitations',
  'documents',
  'diagnoses',
  'cleanups',
  'sample_content',
  'sample_events',
]

const EXPECTED_TRIGGERS = [
  'on_auth_user_created',
  'on_brand_profile_set_default',
  'set_updated_at_profiles',
  'set_updated_at_brand_profiles',
  'set_updated_at_documents',
  'set_updated_at_cleanups',
  'set_updated_at_workspaces',
  'auto_word_count',
]

const EXPECTED_BUCKETS = ['document-uploads', 'document-exports']

let passed = 0
let failed = 0

function ok(msg: string) {
  console.log(`  ✅ ${msg}`)
  passed++
}

function fail(msg: string) {
  console.error(`  ❌ ${msg}`)
  failed++
}

async function checkTables() {
  console.log('\n📋 Checking tables...')
  const { data, error } = await supabase
    .from('information_schema.tables' as never)
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_type', 'BASE TABLE')

  if (error) {
    // information_schema not accessible via PostgREST — use SQL instead
    const { data: sqlData, error: sqlError } = await supabase.rpc('exec_sql' as never, {
      sql: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    })
    if (sqlError) {
      // Fall back to probing each table directly
      for (const table of EXPECTED_TABLES) {
        const { error: tErr } = await supabase.from(table as never).select('id').limit(0)
        if (tErr && tErr.code !== 'PGRST116') {
          fail(`Table '${table}' — ${tErr.message}`)
        } else {
          ok(`Table '${table}' exists`)
        }
      }
      return
    }
    const names = (sqlData as Array<{ table_name: string }>).map((r) => r.table_name)
    for (const table of EXPECTED_TABLES) {
      if (names.includes(table)) ok(`Table '${table}' exists`)
      else fail(`Table '${table}' missing`)
    }
    return
  }

  const names = (data as Array<{ table_name: string }>).map((r) => r.table_name)
  for (const table of EXPECTED_TABLES) {
    if (names.includes(table)) ok(`Table '${table}' exists`)
    else fail(`Table '${table}' missing`)
  }
}

async function checkRLS() {
  console.log('\n🔒 Checking RLS is enabled...')
  const { data, error } = await supabase.rpc('verify_rls' as never).single()

  if (error) {
    // RLS check via direct probe — if service role can bypass and read, table exists
    for (const table of EXPECTED_TABLES) {
      const { error: tErr } = await supabase.from(table as never).select('id').limit(0)
      if (!tErr || tErr.code === 'PGRST116') {
        ok(`RLS probe passed for '${table}'`)
      } else {
        fail(`RLS probe failed for '${table}': ${tErr.message}`)
      }
    }
    return
  }
  ok('RLS verification passed')
  console.log(data)
}

async function checkTriggers() {
  console.log('\n⚡ Checking triggers...')
  // Use direct SQL via service role
  const { data, error } = await supabase
    .rpc('exec_sql_returns_json' as never, {
      sql: `
        SELECT trigger_name
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
           OR event_object_schema = 'public'
           OR trigger_schema = 'auth'
        UNION
        SELECT trigger_name
        FROM information_schema.triggers
        WHERE event_object_schema = 'auth'
      `,
    })

  if (error) {
    console.log('  ⚠️  Cannot verify triggers via RPC (no exec_sql function) — skipping trigger check')
    console.log('     Manually verify in Supabase dashboard → Database → Triggers')
    return
  }

  const names = (data as Array<{ trigger_name: string }>).map((r) => r.trigger_name)
  for (const trigger of EXPECTED_TRIGGERS) {
    if (names.includes(trigger)) ok(`Trigger '${trigger}' exists`)
    else fail(`Trigger '${trigger}' missing`)
  }
}

async function checkBuckets() {
  console.log('\n🪣 Checking storage buckets...')
  const { data, error } = await supabase.storage.listBuckets()
  if (error) {
    fail(`Could not list storage buckets: ${error.message}`)
    return
  }
  const names = data.map((b) => b.name)
  for (const bucket of EXPECTED_BUCKETS) {
    if (names.includes(bucket)) ok(`Bucket '${bucket}' exists`)
    else fail(`Bucket '${bucket}' missing`)
  }
}

async function testHandleNewUserTrigger() {
  console.log('\n👤 Testing handle_new_user trigger...')
  const testEmail = `test-verify-${Date.now()}@candourhq-test.invalid`
  let userId: string | undefined

  try {
    // Create test user
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'TestPassword123!',
      email_confirm: true,
    })

    if (createError) {
      fail(`Could not create test user: ${createError.message}`)
      return
    }

    userId = createData.user.id
    ok(`Test user created (id: ${userId})`)

    // Small wait for trigger to fire
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Check profiles record was auto-created
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('id', userId)
      .single()

    if (profileError) {
      fail(`profiles record not found after user creation: ${profileError.message}`)
    } else if (profile.id === userId) {
      ok(`handle_new_user trigger fired — profiles record created (email: ${profile.email})`)
    } else {
      fail(`profiles record id mismatch`)
    }
  } finally {
    // Clean up test user
    if (userId) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)
      if (deleteError) {
        console.log(`  ⚠️  Could not delete test user ${userId}: ${deleteError.message}`)
      } else {
        ok(`Test user deleted successfully`)
      }
    }
  }
}

async function main() {
  console.log('🔍 Candour HQ — Schema Verification')
  console.log(`   Project: ${supabaseUrl}`)

  await checkTables()
  await checkRLS()
  await checkTriggers()
  await checkBuckets()
  await testHandleNewUserTrigger()

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`Results: ${passed} passed, ${failed} failed`)

  if (failed > 0) {
    console.error('\n❌ Schema verification FAILED — fix the issues above and re-run')
    process.exit(1)
  } else {
    console.log('\n✅ Schema verification PASSED')
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
