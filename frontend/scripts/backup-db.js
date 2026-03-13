/**
 * Backup toàn bộ Supabase database → backup/<date>-db/
 *
 * Chạy: node scripts/backup-db.js
 * Yêu cầu: .env.local với NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */

const { createClient } = require('@supabase/supabase-js');
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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

// Tất cả bảng cần backup
const TABLES = [
    'people',
    'families',
    'profiles',
    'trees',
    'contributions',
    'comments',
    'posts',
    'post_comments',
    'events',
    'event_rsvps',
    'media',
    'notifications',
    'notification_channels',
    'reminder_settings',
    'audit_logs',
    'invite_links',
    'book_sections',
];

async function main() {
    const date = new Date().toISOString().split('T')[0]; // 2026-03-14
    const backupDir = path.join(__dirname, '..', 'backup', `${date}-db`);

    // Tạo thư mục backup
    fs.mkdirSync(backupDir, { recursive: true });

    console.log(`\n📦 Backup Supabase database → ${backupDir}\n`);

    const fullBackup = {
        exported_at: new Date().toISOString(),
        supabase_url: supabaseUrl,
        tables: {},
    };

    let totalRows = 0;

    for (const table of TABLES) {
        process.stdout.write(`  ${table.padEnd(25)}`);
        try {
            const { data, error } = await supabase.from(table).select('*');
            if (error) {
                console.log(`⚠️  Error: ${error.message}`);
                fullBackup.tables[table] = { error: error.message, rows: 0 };
                continue;
            }
            const rows = data || [];
            totalRows += rows.length;

            // Ghi file riêng cho bảng
            fs.writeFileSync(
                path.join(backupDir, `${table}.json`),
                JSON.stringify(rows, null, 2),
                'utf-8'
            );

            fullBackup.tables[table] = { rows: rows.length, data: rows };
            console.log(`✅ ${rows.length} rows`);
        } catch (err) {
            console.log(`❌ ${err.message}`);
            fullBackup.tables[table] = { error: err.message, rows: 0 };
        }
    }

    // Ghi file tổng
    fs.writeFileSync(
        path.join(backupDir, 'full-backup.json'),
        JSON.stringify(fullBackup, null, 2),
        'utf-8'
    );

    console.log(`\n✅ Backup hoàn thành: ${totalRows} rows từ ${TABLES.length} bảng`);
    console.log(`📁 Thư mục: ${backupDir}\n`);
}

main().catch(err => {
    console.error('❌ Backup failed:', err.message);
    process.exit(1);
});
