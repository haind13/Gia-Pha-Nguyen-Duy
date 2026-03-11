/**
 * Parse the Gia Pha CSV and generate mock-data.ts
 * Run: node scripts/csv-to-mock.js
 */
const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, '..', '..', '..', 'Gia_Pha_Nguyen_Duy_Supabase.csv');
const outPath = path.join(__dirname, '..', 'src', 'lib', 'mock-data.ts');

const raw = fs.readFileSync(csvPath, 'utf-8');
const lines = raw.split('\n').filter(l => l.trim());
const header = parseCSVLine(lines[0]);

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current.trim());
    return result;
}

// Parse all rows
const rows = [];
for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 5 || !cols[0]) continue;
    const obj = {};
    header.forEach((h, idx) => { obj[h] = cols[idx] || ''; });
    rows.push(obj);
}

console.log(`Parsed ${rows.length} people from CSV`);

// Extract year from various formats
function extractYear(str) {
    if (!str) return undefined;
    str = str.trim();
    // "1496 (Bính Tuất)" → 1496
    let m = str.match(/^(\d{4})\s*\(/);
    if (m) return parseInt(m[1]);
    // "30/7/1577 (Đinh Sửu)" → 1577
    m = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return parseInt(m[3]);
    // "~1524-1525" → 1524
    m = str.match(/~?(\d{4})/);
    if (m) return parseInt(m[1]);
    // "01/1991 (Canh Ngọ)" → 1991
    m = str.match(/(\d{1,2})\/(\d{4})/);
    if (m) return parseInt(m[2]);
    // "2003 (Quý Mùi)" → 2003
    m = str.match(/^(\d{4})$/);
    if (m) return parseInt(m[1]);
    // Just a plain year
    m = str.match(/(\d{4})/);
    if (m) return parseInt(m[1]);
    return undefined;
}

// Determine death year (also handle "23/6 Đinh Dậu" type formats)
function extractDeathYear(str, birthYear, age) {
    if (!str) return undefined;
    const y = extractYear(str);
    if (y) return y;
    // If no year found but we have birthYear and age, compute
    if (birthYear && age) return birthYear + parseInt(age);
    return undefined;
}

// Extract spouse name from field like "Nghiêm Quý Thị (làng Tây Mỗ...)"
function extractSpouseName(str) {
    if (!str) return '';
    // Remove everything in parentheses at the end, keep the name
    let name = str.replace(/\s*\(.*$/, '').trim();
    // If it starts with "hiệu", it's a title, return empty
    if (name.startsWith('hiệu')) return '';
    // Remove "hiệu xxx" suffix
    name = name.replace(/,?\s*hiệu\s+.*$/, '').trim();
    // Remove "họ Đặng" type references, keep as is
    return name;
}

// Build people and families
const people = [];
const familyMap = new Map(); // cha_id → { children: [], spouseName: '' }
const personMap = new Map(); // id → row

rows.forEach(r => personMap.set(r.id, r));

// First pass: create all person nodes
rows.forEach(r => {
    const birthYear = extractYear(r.nam_sinh);
    const deathYear = extractDeathYear(r.nam_mat, birthYear, r.tho);
    const isMale = r.gioi_tinh === 'Nam';
    const gen = parseInt(r.doi) || 1;

    // Determine if living
    // Rule: Đời ≤ 11 without death info → Đã mất; Đời ≥ 12 without death info → Còn sống
    let isLiving = true; // default to living
    // If we have death year or death info text → deceased
    if (deathYear || (r.nam_mat && r.nam_mat.trim())) isLiving = false;
    // People who died early (ghi_chu contains "Mất sớm") are deceased
    if (r.ghi_chu && r.ghi_chu.includes('Mất sớm')) isLiving = false;
    // Liệt sỹ are deceased
    if (r.ghi_chu && r.ghi_chu.includes('Liệt sỹ')) isLiving = false;
    if (r.ghi_chu && r.ghi_chu.includes('hy sinh')) isLiving = false;
    // Anyone from đời 1-11 (historical, before ~1900s) without death info → deceased
    if (gen <= 11 && !r.nam_mat) isLiving = false;

    const person = {
        handle: r.id,
        displayName: r.ten,
        gender: isMale ? 1 : 2,
        generation: gen,
        birthYear,
        deathYear,
        isLiving,
        isPatrilineal: true, // all members in the CSV are part of the family
        chaId: r.cha_id,
        spouseName1: r.vo_chong_1,
        spouseName2: r.vo_chong_2,
        spouseName3: r.vo_chong_3,
    };

    people.push(person);

    // Track parent-child relationships
    if (r.cha_id) {
        if (!familyMap.has(r.cha_id)) {
            familyMap.set(r.cha_id, { children: [], fatherId: r.cha_id });
        }
        familyMap.get(r.cha_id).children.push(r.id);
    }
});

// Fix generation for children that have same generation as parent
people.forEach(p => {
    if (p.chaId) {
        const parent = people.find(pp => pp.handle === p.chaId);
        if (parent && p.generation <= parent.generation) {
            p.generation = parent.generation + 1;
            console.log(`  Fixed generation for ${p.displayName}: ${p.generation - 1} → ${p.generation}`);
        }
    }
});

// Create spouse nodes for fathers who have wife info
const spouseNodes = [];
const spouseHandleMap = new Map(); // fatherId → spouse handle

familyMap.forEach((fam, fatherId) => {
    const father = people.find(p => p.handle === fatherId);
    if (!father) return;

    const spouseStr = father.spouseName1;
    if (!spouseStr) return;

    const spouseName = extractSpouseName(spouseStr);
    if (!spouseName || spouseName.length < 2) return;
    // Skip placeholder names
    if (spouseName === 'không ghi' || spouseName === 'không rõ') return;

    const spouseHandle = `S_${fatherId}`;
    // Spouse isLiving: same rule — đời ≤ 11 → deceased; đời ≥ 12 → living (unless death info)
    const spouseIsLiving = father.generation >= 12;

    const spouseNode = {
        handle: spouseHandle,
        displayName: spouseName,
        gender: 2,
        generation: father.generation,
        isLiving: spouseIsLiving,
        isPatrilineal: false,
    };

    // Try to determine birth/death from the spouse string
    const yearMatch = spouseStr.match(/(\d{4})/);
    if (yearMatch) {
        spouseNode.birthYear = parseInt(yearMatch[1]);
    }
    const deathMatch = spouseStr.match(/(\d{4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4}|\d{4})/);
    if (deathMatch) {
        spouseNode.birthYear = parseInt(deathMatch[1]);
        const dy = extractYear(deathMatch[2]);
        if (dy) { spouseNode.deathYear = dy; spouseNode.isLiving = false; }
    }
    // e.g., "(1892-28/6/1983, thọ 92 tuổi...)"
    const rangeMatch = spouseStr.match(/\((\d{4})\s*[-–]\s*(?:\d{1,2}\/\d{1,2}\/)?(\d{4})/);
    if (rangeMatch) {
        spouseNode.birthYear = parseInt(rangeMatch[1]);
        spouseNode.deathYear = parseInt(rangeMatch[2]);
        spouseNode.isLiving = false;
    }

    spouseNodes.push(spouseNode);
    spouseHandleMap.set(fatherId, spouseHandle);
});

// Build families array
const families = [];
let famIdx = 1;
familyMap.forEach((fam, fatherId) => {
    const famHandle = `F${String(famIdx).padStart(3, '0')}`;
    famIdx++;

    const familyObj = {
        handle: famHandle,
        fatherHandle: fatherId,
        motherHandle: spouseHandleMap.get(fatherId) || undefined,
        children: fam.children,
    };
    families.push(familyObj);

    // Update person records with family references
    const father = people.find(p => p.handle === fatherId);
    if (father) {
        if (!father.families) father.families = [];
        father.families.push(famHandle);
    }

    fam.children.forEach(childId => {
        const child = people.find(p => p.handle === childId);
        if (child) {
            if (!child.parentFamilies) child.parentFamilies = [];
            child.parentFamilies.push(famHandle);
        }
    });
});

// Ensure all people have families and parentFamilies arrays
people.forEach(p => {
    if (!p.families) p.families = [];
    if (!p.parentFamilies) p.parentFamilies = [];
});

// Also give spouse nodes families reference
spouseNodes.forEach(s => {
    s.families = [];
    s.parentFamilies = [];
});

// Generate TypeScript output
let output = `/**
 * Mock data — Dòng họ Nguyễn Duy — Làng Nghìn, An Bài, Quỳnh Phụ, Thái Bình
 * Generated from Gia_Pha_Nguyen_Duy_Supabase.csv
 * ${people.length + spouseNodes.length} thành viên, ${new Set(people.map(p => p.generation)).size} thế hệ
 */
import type { TreeNode, TreeFamily } from './tree-layout';

export const MOCK_PEOPLE: TreeNode[] = [\n`;

// Group people by generation for comments
const genGroups = new Map();
[...people, ...spouseNodes].forEach(p => {
    const g = p.generation || 0;
    if (!genGroups.has(g)) genGroups.set(g, []);
    genGroups.get(g).push(p);
});

const sortedGens = [...genGroups.keys()].sort((a, b) => a - b);

sortedGens.forEach(gen => {
    output += `    // ═══ Đời ${gen} ═══\n`;
    const members = genGroups.get(gen);
    members.forEach(p => {
        const parts = [];
        parts.push(`handle: '${p.handle}'`);
        parts.push(`displayName: '${p.displayName.replace(/'/g, "\\'")}'`);
        parts.push(`gender: ${p.gender}`);
        parts.push(`generation: ${p.generation}`);
        if (p.birthYear) parts.push(`birthYear: ${p.birthYear}`);
        if (p.deathYear) parts.push(`deathYear: ${p.deathYear}`);
        parts.push(`isLiving: ${p.isLiving}`);
        parts.push(`isPrivacyFiltered: false`);
        parts.push(`isPatrilineal: ${p.isPatrilineal}`);
        parts.push(`families: [${p.families.map(f => `'${f}'`).join(', ')}]`);
        parts.push(`parentFamilies: [${p.parentFamilies.map(f => `'${f}'`).join(', ')}]`);
        output += `    { ${parts.join(', ')} },\n`;
    });
});

output += `];\n\n`;

// Families
output += `export const MOCK_FAMILIES: TreeFamily[] = [\n`;
families.forEach(f => {
    const parts = [];
    parts.push(`handle: '${f.handle}'`);
    parts.push(`fatherHandle: '${f.fatherHandle}'`);
    if (f.motherHandle) parts.push(`motherHandle: '${f.motherHandle}'`);
    parts.push(`children: [${f.children.map(c => `'${c}'`).join(', ')}]`);
    output += `    { ${parts.join(', ')} },\n`;
});
output += `];\n\n`;

// Memorial events (ngày giỗ)
const memorials = [];

// 1) Main people with ngay_gio column (lunar dates)
rows.forEach(r => {
    if (!r.ngay_gio || !r.ngay_gio.trim()) return;
    const ngayGio = r.ngay_gio.trim();
    const m = ngayGio.match(/(\d{1,2})\/(\d{1,2})\s*ÂL/);
    if (!m) return;
    const day = parseInt(m[1]);
    const month = parseInt(m[2]);
    const person = people.find(p => p.handle === r.id);
    const gen = person ? person.generation : (parseInt(r.doi) || 0);
    const deathYear = person ? person.deathYear : extractYear(r.nam_mat);
    memorials.push({
        personHandle: r.id,
        personName: r.ten,
        generation: gen,
        day,
        month,
        deathYear,
        isLunar: true,
    });
});

// 2) Spouse death dates extracted from vo_chong fields
function extractSpouseMemorial(spouseStr, fatherId) {
    if (!spouseStr) return null;
    const spouseName = extractSpouseName(spouseStr);
    if (!spouseName || spouseName.length < 2) return null;

    // Pattern: "mất DD/MM" (no year — likely lunar date)
    let m = spouseStr.match(/mất\s+(\d{1,2})\/(\d{1,2})(?![\/\d])/);
    if (m) {
        return { day: parseInt(m[1]), month: parseInt(m[2]), isLunar: true, spouseName };
    }

    // Pattern: "mất DD/MM/YYYY" (solar date with year)
    m = spouseStr.match(/mất\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) {
        return { day: parseInt(m[1]), month: parseInt(m[2]), deathYear: parseInt(m[3]), isLunar: false, spouseName };
    }

    // Pattern: "(YYYY-DD/MM/YYYY" (birth-death range)
    m = spouseStr.match(/\(\d{4}\s*[-–]\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) {
        return { day: parseInt(m[1]), month: parseInt(m[2]), deathYear: parseInt(m[3]), isLunar: false, spouseName };
    }

    return null;
}

rows.forEach(r => {
    const father = people.find(p => p.handle === r.id);
    if (!father) return;

    ['vo_chong_1', 'vo_chong_2', 'vo_chong_3'].forEach((field, idx) => {
        const spouseStr = r[field];
        if (!spouseStr) return;
        const result = extractSpouseMemorial(spouseStr, r.id);
        if (!result) return;

        const spouseHandle = `S_${r.id}${idx > 0 ? '_' + (idx + 1) : ''}`;
        // Check if this spouse is already in the main memorials list (unlikely but safe)
        if (memorials.find(m => m.personHandle === spouseHandle)) return;

        memorials.push({
            personHandle: spouseHandle,
            personName: result.spouseName,
            generation: father.generation,
            day: result.day,
            month: result.month,
            deathYear: result.deathYear,
            isLunar: result.isLunar,
        });
    });
});

// Sort memorials by month then day
memorials.sort((a, b) => a.month - b.month || a.day - b.day);
const lunarCount = memorials.filter(m => m.isLunar).length;
const solarCount = memorials.filter(m => !m.isLunar).length;
console.log(`  Memorials (ngày giỗ): ${memorials.length} (${lunarCount} Âm lịch, ${solarCount} Dương lịch)`);

output += `export interface MemorialEvent {\n    personHandle: string;\n    personName: string;\n    generation: number;\n    day: number;\n    month: number;\n    deathYear?: number;\n    isLunar: boolean;\n}\n\n`;

output += `export const MOCK_MEMORIALS: MemorialEvent[] = [\n`;
memorials.forEach(m => {
    const parts = [];
    parts.push(`personHandle: '${m.personHandle}'`);
    parts.push(`personName: '${m.personName.replace(/'/g, "\\'")}'`);
    parts.push(`generation: ${m.generation}`);
    parts.push(`day: ${m.day}`);
    parts.push(`month: ${m.month}`);
    if (m.deathYear) parts.push(`deathYear: ${m.deathYear}`);
    parts.push(`isLunar: ${m.isLunar}`);
    output += `    { ${parts.join(', ')} },\n`;
});
output += `];\n\n`;

output += `export function getMockTreeData() {\n    return { people: MOCK_PEOPLE, families: MOCK_FAMILIES };\n}\n`;

fs.writeFileSync(outPath, output, 'utf-8');
console.log(`\nGenerated ${outPath}`);
console.log(`  People: ${people.length + spouseNodes.length} (${people.length} from CSV + ${spouseNodes.length} spouses)`);
console.log(`  Families: ${families.length}`);
console.log(`  Generations: ${sortedGens.join(', ')}`);
