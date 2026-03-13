/**
 * Book Generator — Transforms genealogy tree data into a structured book format.
 *
 * Produces chapters by generation, with each patrilineal person getting
 * a full entry showing parents, spouse, and children.
 */

import type { TreeNode, TreeFamily } from './tree-layout';

// ═══ Book Data Types ═══

export interface BookPerson {
    id: string;
    name: string;
    gender: number;
    birthYear?: number;
    deathYear?: number;
    isLiving: boolean;
    isPatrilineal: boolean;
    generation: number;
    fatherName?: string;
    motherName?: string;
    spouseName?: string;
    spouseYears?: string;
    spouseNote?: string; // "(Ngoại tộc)"
    children: { name: string; years: string; note?: string }[];
    childIndex?: number; // thứ tự con trong gia đình (1, 2, 3...)
}

export interface BookChapter {
    generation: number;
    title: string;         // "ĐỜI THỨ I — THỦY TỔ"
    romanNumeral: string;  // "I", "II", etc.
    members: BookPerson[];
}

export interface BookData {
    familyName: string;
    exportDate: string;
    totalGenerations: number;
    totalMembers: number;
    totalPatrilineal: number;
    chapters: BookChapter[];
    nameIndex: { name: string; generation: number; isPatrilineal: boolean }[];
}

// ═══ Helpers ═══

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
    'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];

const GEN_NAMES: Record<number, string> = {
    0: 'THỦY TỔ',
};

function romanNumeral(n: number): string {
    return ROMAN[n] || `${n + 1}`;
}

function genTitle(gen: number): string {
    const roman = romanNumeral(gen);
    const name = GEN_NAMES[gen] || '';
    return name ? `ĐỜI THỨ ${roman} — ${name}` : `ĐỜI THỨ ${roman}`;
}

function formatYears(birth?: number, death?: number, isLiving?: boolean): string {
    if (!birth) return '—';
    if (death) return `${birth} – ${death}`;
    if (isLiving) return `${birth} – nay`;
    return `${birth}`;
}

// ═══ Main Generator ═══

export function generateBookData(
    people: TreeNode[],
    families: TreeFamily[],
    familyName: string = 'Nguyễn Duy',
): BookData {
    const personMap = new Map(people.map(p => [p.id, p]));
    const familyMap = new Map(families.map(f => [f.id, f]));

    // ── Step 1: Assign generations via BFS from roots ──
    const generations = new Map<string, number>();
    const childOfFamily = new Set<string>();
    for (const f of families) {
        for (const ch of f.childIds) childOfFamily.add(ch);
    }

    // Find root persons (not a child of any family)
    const roots = people.filter(p => !childOfFamily.has(p.id));

    function setGen(handle: string, gen: number) {
        if (generations.has(handle)) return;
        generations.set(handle, gen);
        const person = personMap.get(handle);
        if (!person) return;
        for (const famId of person.familyIds) {
            const fam = familyMap.get(famId);
            if (!fam) continue;
            // Spouse gets same generation
            if (fam.fatherId && fam.fatherId !== handle) {
                if (!generations.has(fam.fatherId)) generations.set(fam.fatherId, gen);
            }
            if (fam.motherId && fam.motherId !== handle) {
                if (!generations.has(fam.motherId)) generations.set(fam.motherId, gen);
            }
            // Children get gen+1
            for (const ch of fam.childIds) setGen(ch, gen + 1);
        }
    }

    for (const r of roots) {
        setGen(r.id, 0);
    }
    // Catch any unassigned
    for (const p of people) {
        if (!generations.has(p.id)) generations.set(p.id, 0);
    }

    // ── Step 2: Build person entries ──
    const bookPersons: BookPerson[] = [];

    // Group by generation
    const genGroups = new Map<number, TreeNode[]>();
    for (const p of people) {
        const gen = generations.get(p.id) ?? 0;
        if (!genGroups.has(gen)) genGroups.set(gen, []);
        genGroups.get(gen)!.push(p);
    }

    // For each patrilineal person, build a BookPerson entry
    for (const p of people) {
        if (!p.isPatrilineal) continue;

        const gen = generations.get(p.id) ?? 0;

        // Find parent info
        let fatherName: string | undefined;
        let motherName: string | undefined;
        for (const pfId of p.parentFamilyIds) {
            const pf = familyMap.get(pfId);
            if (pf) {
                if (pf.fatherId) {
                    const father = personMap.get(pf.fatherId);
                    if (father) fatherName = father.displayName;
                }
                if (pf.motherId) {
                    const mother = personMap.get(pf.motherId);
                    if (mother) motherName = mother.displayName;
                }
            }
        }

        // Find spouse and children from families where this person is a parent
        let spouseName: string | undefined;
        let spouseYears: string | undefined;
        let spouseNote: string | undefined;
        const children: BookPerson['children'] = [];

        for (const famId of p.familyIds) {
            const fam = familyMap.get(famId);
            if (!fam) continue;

            // Determine spouse
            const spouseHandle = fam.fatherId === p.id ? fam.motherId : fam.fatherId;
            if (spouseHandle) {
                const spouse = personMap.get(spouseHandle);
                if (spouse) {
                    spouseName = spouse.displayName;
                    spouseYears = formatYears(spouse.birthYear, spouse.deathYear, spouse.isLiving);
                    if (!spouse.isPatrilineal) spouseNote = 'Ngoại tộc';
                }
            }

            // Children
            for (let i = 0; i < fam.childIds.length; i++) {
                const childHandle = fam.childIds[i];
                const child = personMap.get(childHandle);
                if (child) {
                    children.push({
                        name: child.displayName,
                        years: formatYears(child.birthYear, child.deathYear, child.isLiving),
                        note: !child.isPatrilineal ? 'Ngoại tộc' : undefined,
                    });
                }
            }
        }

        // Find child index within parent family
        let childIndex: number | undefined;
        if (p.parentFamilyIds.length > 0) {
            const pf = familyMap.get(p.parentFamilyIds[0]);
            if (pf) {
                const idx = pf.childIds.indexOf(p.id);
                if (idx >= 0) childIndex = idx + 1;
            }
        }

        bookPersons.push({
            id: p.id,
            name: p.displayName,
            gender: p.gender,
            birthYear: p.birthYear,
            deathYear: p.deathYear,
            isLiving: p.isLiving,
            isPatrilineal: p.isPatrilineal,
            generation: gen,
            fatherName,
            motherName,
            spouseName,
            spouseYears,
            spouseNote,
            children,
            childIndex,
        });
    }

    // ── Step 3: Build chapters ──
    const maxGen = Math.max(...Array.from(generations.values()));
    const chapters: BookChapter[] = [];

    for (let g = 0; g <= maxGen; g++) {
        const members = bookPersons
            .filter(bp => bp.generation === g)
            .sort((a, b) => (a.childIndex ?? 99) - (b.childIndex ?? 99));

        if (members.length === 0) continue;

        chapters.push({
            generation: g,
            title: genTitle(g),
            romanNumeral: romanNumeral(g),
            members,
        });
    }

    // ── Step 4: Build name index ──
    const nameIndex = people
        .map(p => ({
            name: p.displayName,
            generation: generations.get(p.id) ?? 0,
            isPatrilineal: p.isPatrilineal,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

    return {
        familyName,
        exportDate: new Date().toLocaleDateString('vi-VN', {
            year: 'numeric', month: 'long', day: 'numeric',
        }),
        totalGenerations: maxGen + 1,
        totalMembers: people.length,
        totalPatrilineal: people.filter(p => p.isPatrilineal).length,
        chapters,
        nameIndex,
    };
}
