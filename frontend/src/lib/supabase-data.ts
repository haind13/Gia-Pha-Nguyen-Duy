/**
 * Supabase data layer for the genealogy tree
 * Replaces localStorage-based persistence with Supabase PostgreSQL
 */
import { supabase } from './supabase';
import type { TreeNode, TreeFamily } from './tree-layout';
import type { PersonDetail, BookSection } from './genealogy-types';

export type { TreeNode, TreeFamily };

// ── Default tree_id cache ──
let _defaultTreeId: string | null = null;

/** Get the default tree UUID (slug='main'). Cached after first call. */
async function getDefaultTreeId(): Promise<string | null> {
    if (_defaultTreeId) return _defaultTreeId;
    const { data, error } = await supabase
        .from('trees')
        .select('id')
        .eq('slug', 'main')
        .limit(1)
        .single();
    if (error || !data) {
        console.error('Failed to fetch default tree:', error?.message);
        return null;
    }
    _defaultTreeId = data.id as string;
    return _defaultTreeId;
}

// ── Convert snake_case DB rows to camelCase ──

function dbRowToTreeNode(row: Record<string, unknown>): TreeNode {
    return {
        id: row.id as string,
        displayName: row.display_name as string,
        gender: row.gender as number,
        birthYear: row.birth_year as number | undefined,
        deathYear: row.death_year as number | undefined,
        generation: row.generation as number,
        isLiving: row.is_living as boolean,
        isPrivacyFiltered: row.is_privacy_filtered as boolean,
        isPatrilineal: row.is_patrilineal as boolean,
        birthOrder: row.birth_order as number | undefined,
        familyIds: (row.family_ids as string[]) || [],
        parentFamilyIds: (row.parent_family_ids as string[]) || [],
    };
}

function dbRowToTreeFamily(row: Record<string, unknown>): TreeFamily {
    return {
        id: row.id as string,
        fatherId: row.father_id as string | undefined,
        motherId: row.mother_id as string | undefined,
        childIds: (row.child_ids as string[]) || [],
    };
}

// ── Read operations ──

/** Fetch all people from Supabase */
export async function fetchPeople(): Promise<TreeNode[]> {
    const { data, error } = await supabase
        .from('people')
        .select('id, display_name, gender, birth_year, death_year, generation, is_living, is_privacy_filtered, is_patrilineal, birth_order, family_ids, parent_family_ids')
        .order('generation')
        .order('id');

    if (error) {
        console.error('Failed to fetch people:', error.message);
        return [];
    }
    return (data || []).map(dbRowToTreeNode);
}

/** Fetch all families from Supabase */
export async function fetchFamilies(): Promise<TreeFamily[]> {
    const { data, error } = await supabase
        .from('families')
        .select('id, father_id, mother_id, child_ids')
        .order('id');

    if (error) {
        console.error('Failed to fetch families:', error.message);
        return [];
    }
    return (data || []).map(dbRowToTreeFamily);
}

/** Fetch both people and families in parallel */
export async function fetchTreeData(): Promise<{ people: TreeNode[]; families: TreeFamily[] }> {
    const [people, families] = await Promise.all([fetchPeople(), fetchFamilies()]);
    return { people, families };
}

// ── Write operations (editor mode) ──

/** Update children order for a family */
export async function updateFamilyChildren(
    familyId: string,
    newChildrenOrder: string[]
): Promise<void> {
    const { error } = await supabase
        .from('families')
        .update({ child_ids: newChildrenOrder })
        .eq('id', familyId);

    if (error) console.error('Failed to update family children:', error.message);
}

/** Move a child from one family to another */
export async function moveChildToFamily(
    childId: string,
    fromFamilyId: string,
    toFamilyId: string,
    currentFamilies: TreeFamily[]
): Promise<void> {
    const fromFam = currentFamilies.find(f => f.id === fromFamilyId);
    const toFam = currentFamilies.find(f => f.id === toFamilyId);

    const updates: Promise<unknown>[] = [];

    // Update families.child_ids on both families
    if (fromFam) {
        updates.push(
            updateFamilyChildren(fromFamilyId, fromFam.childIds.filter(ch => ch !== childId))
        );
    }
    if (toFam) {
        updates.push(
            updateFamilyChildren(toFamilyId, [...toFam.childIds.filter(ch => ch !== childId), childId])
        );
    }

    // Update people.parent_family_ids on the child
    const { data: personData } = await supabase
        .from('people')
        .select('parent_family_ids')
        .eq('id', childId)
        .single();

    if (personData) {
        const currentPF = (personData.parent_family_ids as string[]) || [];
        const newPF = [...currentPF.filter(pf => pf !== fromFamilyId), toFamilyId];
        updates.push(
            (async () => { await supabase.from('people').update({ parent_family_ids: newPF, updated_at: new Date().toISOString() }).eq('id', childId); })()
        );
    }

    await Promise.all(updates);
}

/** Remove a child from a family */
export async function removeChildFromFamily(
    childId: string,
    familyId: string,
    currentFamilies: TreeFamily[]
): Promise<void> {
    const fam = currentFamilies.find(f => f.id === familyId);
    const updates: Promise<unknown>[] = [];

    if (fam) {
        updates.push(
            updateFamilyChildren(familyId, fam.childIds.filter(ch => ch !== childId))
        );
    }

    // Also update people.parent_family_ids on the child
    const { data: personData } = await supabase
        .from('people')
        .select('parent_family_ids')
        .eq('id', childId)
        .single();

    if (personData) {
        const currentPF = (personData.parent_family_ids as string[]) || [];
        const newPF = currentPF.filter(pf => pf !== familyId);
        updates.push(
            (async () => { await supabase.from('people').update({ parent_family_ids: newPF, updated_at: new Date().toISOString() }).eq('id', childId); })()
        );
    }

    await Promise.all(updates);
}

/** Update a person's isLiving status */
export async function updatePersonLiving(
    id: string,
    isLiving: boolean
): Promise<void> {
    const { error } = await supabase
        .from('people')
        .update({ is_living: isLiving })
        .eq('id', id);

    if (error) console.error('Failed to update person living status:', error.message);
}

/** Editable person fields (camelCase) */
export interface PersonEditFields {
    displayName?: string;
    birthYear?: number | null;
    birthDate?: string | null;
    birthPlace?: string | null;
    deathYear?: number | null;
    deathDate?: string | null;
    deathPlace?: string | null;
    isLiving?: boolean;
    phone?: string | null;
    email?: string | null;
    zalo?: string | null;
    facebook?: string | null;
    currentAddress?: string | null;
    hometown?: string | null;
    occupation?: string | null;
    company?: string | null;
    education?: string | null;
    nickName?: string | null;
    notes?: string | null;
    title?: string | null;
    birthOrder?: number | null;
    maritalStatus?: string | null;
    bloodType?: string | null;
}

/** Update a person's editable fields */
export async function updatePerson(
    id: string,
    fields: PersonEditFields
): Promise<{ error: string | null }> {
    // Convert camelCase → snake_case for DB
    const dbFields: Record<string, unknown> = {};
    if (fields.displayName !== undefined) dbFields.display_name = fields.displayName;
    if (fields.birthYear !== undefined) dbFields.birth_year = fields.birthYear;
    if (fields.birthDate !== undefined) dbFields.birth_date = fields.birthDate;
    if (fields.birthPlace !== undefined) dbFields.birth_place = fields.birthPlace;
    if (fields.deathYear !== undefined) dbFields.death_year = fields.deathYear;
    if (fields.deathDate !== undefined) dbFields.death_date = fields.deathDate;
    if (fields.deathPlace !== undefined) dbFields.death_place = fields.deathPlace;
    if (fields.isLiving !== undefined) dbFields.is_living = fields.isLiving;
    if (fields.phone !== undefined) dbFields.phone = fields.phone;
    if (fields.email !== undefined) dbFields.email = fields.email;
    if (fields.zalo !== undefined) dbFields.zalo = fields.zalo;
    if (fields.facebook !== undefined) dbFields.facebook = fields.facebook;
    if (fields.currentAddress !== undefined) dbFields.current_address = fields.currentAddress;
    if (fields.hometown !== undefined) dbFields.hometown = fields.hometown;
    if (fields.occupation !== undefined) dbFields.occupation = fields.occupation;
    if (fields.company !== undefined) dbFields.company = fields.company;
    if (fields.education !== undefined) dbFields.education = fields.education;
    if (fields.nickName !== undefined) dbFields.nick_name = fields.nickName;
    if (fields.notes !== undefined) dbFields.notes = fields.notes;
    if (fields.title !== undefined) dbFields.title = fields.title;
    if (fields.birthOrder !== undefined) dbFields.birth_order = fields.birthOrder;
    if (fields.maritalStatus !== undefined) dbFields.marital_status = fields.maritalStatus;
    if (fields.bloodType !== undefined) dbFields.blood_type = fields.bloodType;
    dbFields.updated_at = new Date().toISOString();

    const { error } = await supabase
        .from('people')
        .update(dbFields)
        .eq('id', id);

    if (error) {
        console.error('Failed to update person:', error.message);
        return { error: error.message };
    }
    return { error: null };
}

/** Add a new person to the tree */
export async function addPerson(person: {
    id: string;
    displayName: string;
    gender: number;
    generation: number;
    birthYear?: number | null;
    deathYear?: number | null;
    isLiving?: boolean;
    isPatrilineal?: boolean;
    familyIds?: string[];
    parentFamilyIds?: string[];
    // Extended fields
    nickName?: string | null;
    birthDate?: string | null;
    birthPlace?: string | null;
    deathDate?: string | null;
    deathPlace?: string | null;
    phone?: string | null;
    currentAddress?: string | null;
    education?: string | null;
    occupation?: string | null;
    company?: string | null;
    notes?: string | null;
    title?: string | null;
    birthOrder?: number | null;
    maritalStatus?: string | null;
    bloodType?: string | null;
}): Promise<{ error: string | null }> {
    const treeId = await getDefaultTreeId();
    if (!treeId) return { error: 'Could not determine default tree_id' };

    const dbRow: Record<string, unknown> = {
        id: person.id,
        display_name: person.displayName,
        gender: person.gender,
        generation: person.generation,
        birth_year: person.birthYear || null,
        death_year: person.deathYear || null,
        is_living: person.isLiving ?? true,
        is_privacy_filtered: false,
        is_patrilineal: person.isPatrilineal ?? !person.id.startsWith('S_'),
        family_ids: person.familyIds || [],
        parent_family_ids: person.parentFamilyIds || [],
        tree_id: treeId,
    };
    // Add optional extended fields only if provided
    if (person.nickName) dbRow.nick_name = person.nickName;
    if (person.birthDate) dbRow.birth_date = person.birthDate;
    if (person.birthPlace) dbRow.birth_place = person.birthPlace;
    if (person.deathDate) dbRow.death_date = person.deathDate;
    if (person.deathPlace) dbRow.death_place = person.deathPlace;
    if (person.phone) dbRow.phone = person.phone;
    if (person.currentAddress) dbRow.current_address = person.currentAddress;
    if (person.education) dbRow.education = person.education;
    if (person.occupation) dbRow.occupation = person.occupation;
    if (person.company) dbRow.company = person.company;
    if (person.notes) dbRow.notes = person.notes;
    if (person.title) dbRow.title = person.title;
    if (person.birthOrder != null) dbRow.birth_order = person.birthOrder;
    if (person.maritalStatus) dbRow.marital_status = person.maritalStatus;
    if (person.bloodType) dbRow.blood_type = person.bloodType;

    const { error } = await supabase
        .from('people')
        .insert(dbRow);

    if (error) {
        console.error('Failed to add person:', error.message);
        return { error: error.message };
    }
    return { error: null };
}

/** Delete a person from the tree */
export async function deletePerson(id: string): Promise<{ error: string | null }> {
    const { error } = await supabase
        .from('people')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Failed to delete person:', error.message);
        return { error: error.message };
    }
    return { error: null };
}

/** Add a new family */
export async function addFamily(family: {
    id: string;
    fatherId?: string;
    motherId?: string;
    childIds?: string[];
}): Promise<{ error: string | null }> {
    const treeId = await getDefaultTreeId();
    if (!treeId) return { error: 'Could not determine default tree_id' };

    const { error } = await supabase
        .from('families')
        .insert({
            id: family.id,
            father_id: family.fatherId || null,
            mother_id: family.motherId || null,
            child_ids: family.childIds || [],
            tree_id: treeId,
        });

    if (error) {
        console.error('Failed to add family:', error.message);
        return { error: error.message };
    }
    return { error: null };
}

/** Update a person's family_ids array (denormalized field on people table) */
export async function updatePersonFamilies(id: string, familyIds: string[]): Promise<{ error: string | null }> {
    const { error } = await supabase
        .from('people')
        .update({ family_ids: familyIds })
        .eq('id', id);

    if (error) {
        console.error('Failed to update person families:', error.message);
        return { error: error.message };
    }
    return { error: null };
}

/** Fetch full person detail by id */
export async function fetchPersonDetail(id: string): Promise<PersonDetail | null> {
    const { data, error } = await supabase
        .from('people')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !data) {
        console.error('Failed to fetch person detail:', error?.message);
        return null;
    }

    const row = data as Record<string, unknown>;
    return {
        id: row.id as string,
        displayName: row.display_name as string,
        gender: row.gender as number,
        birthYear: row.birth_year as number | undefined,
        deathYear: row.death_year as number | undefined,
        birthDate: row.birth_date as string | undefined,
        birthPlace: row.birth_place as string | undefined,
        deathDate: row.death_date as string | undefined,
        deathPlace: row.death_place as string | undefined,
        generation: row.generation as number,
        chi: row.chi as number | undefined,
        isLiving: row.is_living as boolean,
        isPrivacyFiltered: row.is_privacy_filtered as boolean,
        isPatrilineal: row.is_patrilineal as boolean,
        familyIds: (row.family_ids as string[]) || [],
        parentFamilyIds: (row.parent_family_ids as string[]) || [],
        surname: row.surname as string | undefined,
        firstName: row.first_name as string | undefined,
        nickName: row.nick_name as string | undefined,
        phone: row.phone as string | undefined,
        email: row.email as string | undefined,
        zalo: row.zalo as string | undefined,
        facebook: row.facebook as string | undefined,
        currentAddress: row.current_address as string | undefined,
        hometown: row.hometown as string | undefined,
        occupation: row.occupation as string | undefined,
        company: row.company as string | undefined,
        education: row.education as string | undefined,
        notes: row.notes as string | undefined,
        title: row.title as string | undefined,
        birthOrder: row.birth_order as number | undefined,
        maritalStatus: row.marital_status as string | undefined,
        bloodType: row.blood_type as string | undefined,
    };
}

// ── Book sections CRUD ──

function dbRowToBookSection(row: Record<string, unknown>): BookSection {
    return {
        id: row.id as string,
        sectionKey: row.section_key as string,
        title: row.title as string,
        content: row.content as string | undefined,
        sortOrder: (row.sort_order as number) ?? 0,
        isVisible: (row.is_visible as boolean) ?? true,
        updatedAt: row.updated_at as string | undefined,
        updatedBy: row.updated_by as string | undefined,
    };
}

/** Fetch all book sections */
export async function fetchBookSections(): Promise<BookSection[]> {
    const { data, error } = await supabase
        .from('book_sections')
        .select('*')
        .order('sort_order');

    if (error) {
        console.error('Failed to fetch book sections:', error.message);
        return [];
    }
    return (data || []).map(dbRowToBookSection);
}

/** Create or update a book section */
export async function upsertBookSection(
    sectionKey: string,
    title: string,
    content: string,
    sortOrder?: number
): Promise<{ error: string | null }> {
    const { error } = await supabase
        .from('book_sections')
        .upsert({
            section_key: sectionKey,
            title,
            content,
            sort_order: sortOrder ?? 0,
            is_visible: true,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'section_key' });

    if (error) {
        console.error('Failed to upsert book section:', error.message);
        return { error: error.message };
    }
    return { error: null };
}

/** Update a book section by section_key */
export async function updateBookSection(
    sectionKey: string,
    fields: Partial<{ title: string; content: string; sortOrder: number; isVisible: boolean }>
): Promise<{ error: string | null }> {
    const dbFields: Record<string, unknown> = {};
    if (fields.title !== undefined) dbFields.title = fields.title;
    if (fields.content !== undefined) dbFields.content = fields.content;
    if (fields.sortOrder !== undefined) dbFields.sort_order = fields.sortOrder;
    if (fields.isVisible !== undefined) dbFields.is_visible = fields.isVisible;
    dbFields.updated_at = new Date().toISOString();

    const { error } = await supabase
        .from('book_sections')
        .update(dbFields)
        .eq('section_key', sectionKey);

    if (error) {
        console.error('Failed to update book section:', error.message);
        return { error: error.message };
    }
    return { error: null };
}

/** Delete a book section */
export async function deleteBookSection(sectionKey: string): Promise<{ error: string | null }> {
    const { error } = await supabase
        .from('book_sections')
        .delete()
        .eq('section_key', sectionKey);

    if (error) {
        console.error('Failed to delete book section:', error.message);
        return { error: error.message };
    }
    return { error: null };
}
