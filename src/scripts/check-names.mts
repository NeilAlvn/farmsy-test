import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const { data } = await sb.from('farms').select('name').order('name')
const counts: Record<string, number> = {}
for (const r of data ?? []) counts[r.name] = (counts[r.name] || 0) + 1

const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 80)
console.log('\nCount  Name')
console.log('-----  ' + '-'.repeat(50))
for (const [name, count] of sorted) {
  console.log(count.toString().padStart(5) + '  ' + name)
}
console.log(`\nTotal unique names: ${Object.keys(counts).length}`)
