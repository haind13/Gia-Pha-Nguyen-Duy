/**
 * Run SQL migration files on Supabase PostgreSQL
 *
 * Usage: node scripts/run-migrations.js
 * Requires: SUPABASE_DB_PASSWORD in .env.local
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
        env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
}

// Extract project ref from URL
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || '';
const refMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
const projectRef = refMatch ? refMatch[1] : '';
const dbPassword = env.SUPABASE_DB_PASSWORD;

if (!projectRef || !dbPassword) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_DB_PASSWORD in .env.local');
    process.exit(1);
}

// Migration files to run (in order)
const MIGRATIONS = [
    '005_rename_columns.sql',
    '006_add_tree_id_and_marriage.sql',
    '007_fix_profiles.sql',
    '008_posts_and_post_comments.sql',
    '009_events_and_rsvps.sql',
    '010_media_and_notifications.sql',
    '011_audit_invites_book.sql',
];

async function main() {
    // Try multiple connection formats (Supabase changed formats over time)
    const hosts = [
        { host: `db.${projectRef}.supabase.co`, port: 5432, user: 'postgres' },
        { host: `aws-0-ap-southeast-1.pooler.supabase.com`, port: 5432, user: `postgres.${projectRef}` },
        { host: `aws-0-us-east-1.pooler.supabase.com`, port: 5432, user: `postgres.${projectRef}` },
        { host: `aws-0-eu-west-1.pooler.supabase.com`, port: 5432, user: `postgres.${projectRef}` },
    ];

    let client;
    for (const h of hosts) {
        console.log(`🔌 Trying ${h.user}@${h.host}:${h.port} ...`);
        const c = new Client({
            host: h.host,
            port: h.port,
            database: 'postgres',
            user: h.user,
            password: dbPassword,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 10000,
        });
        try {
            await c.connect();
            console.log('✅ Connected!\n');
            client = c;
            break;
        } catch (err) {
            console.log(`   ❌ ${err.message}\n`);
        }
    }

    if (!client) {
        console.error('❌ Could not connect to any Supabase PostgreSQL host');
        process.exit(1);
    }

    const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

    for (const file of MIGRATIONS) {
        const filePath = path.join(migrationsDir, file);
        if (!fs.existsSync(filePath)) {
            console.log(`⚠️  ${file} — not found, skipping`);
            continue;
        }

        const sql = fs.readFileSync(filePath, 'utf-8');
        process.stdout.write(`  ${file.padEnd(45)}`);

        try {
            await client.query(sql);
            console.log('✅ OK');
        } catch (err) {
            console.log(`❌ Error: ${err.message}`);
            // Don't stop on error — some migrations may partially succeed
            // (e.g., IF NOT EXISTS tables already created)
        }
    }

    await client.end();
    console.log('\n🎉 Migration complete!\n');
}

main().catch(err => {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
});
