/**
 * Shared tree utility functions.
 * All descendant-walking logic should use buildParentToFamiliesMap() instead of
 * person.familyIds (which is a denormalized field that can be out-of-sync).
 */
import type { TreeFamily } from './tree-layout';

/**
 * Build a map: person id → family ids where that person is father or mother.
 * Uses the families TABLE (source of truth), NOT person.familyIds (denormalized).
 *
 * This replaces all usage of `person.familyIds` for descendant walking, because
 * person.familyIds is not reliably kept in sync when new families are created
 * via quick-add (the parent's familyIds field was not persisted to Supabase).
 */
export function buildParentToFamiliesMap(families: TreeFamily[]): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const f of families) {
        if (f.fatherId) {
            const list = map.get(f.fatherId);
            if (list) {
                list.push(f.id);
            } else {
                map.set(f.fatherId, [f.id]);
            }
        }
        if (f.motherId) {
            const list = map.get(f.motherId);
            if (list) {
                list.push(f.id);
            } else {
                map.set(f.motherId, [f.id]);
            }
        }
    }
    return map;
}
