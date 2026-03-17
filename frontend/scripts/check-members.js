const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (t.length === 0 || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq > 0) env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

Promise.all([
    sb.from('people').select('id').limit(5),
    sb.from('members').select('id, ten').limit(5),
]).then(([p, m]) => {
    console.log('people IDs:', p.data?.map(r => r.id));
    console.log('members IDs:', m.data?.map(r => r.id + ' -> ' + r.ten));
});
