import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });
import { createClient } from '@supabase/supabase-js';

async function main() {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { count, error } = await sb.from('farms').select('*', { count: 'exact', head: true });
    if (error) {
        console.error('Error:', error);
    } else {
        console.log('TOTAL_FARMS:', count);
    }
}
main();
