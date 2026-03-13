/**
 * Shared tree utility functions.
 * All descendant-walking logic should use buildParentToFamiliesMap() instead of
 * person.families (which is a denormalized field that can be out-of-sync).
 */
import type { TreeFamily } from './tree-layout';

/**
 * Build a map: person handle → family handles where that person is father or mother.
 * Uses the families TABLE (source of truth), NOT person.families (denormalized).
 *
 * This replaces all usage of `person.families` for descendant walking, because
 * person.families is not reliably kept in sync when new families are created
 * via quick-add (the parent's families field was not persisted to Supabase).
 */
export function buildParentToFamiliesMap(families: TreeFamily[]): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const f of families) {
        if (f.fatherHandle) {
            const list = map.get(f.fatherHandle);
            if (list) {
                list.push(f.handle);
            } else {
                map.set(f.fatherHandle, [f.handle]);
            }
        }
        if (f.motherHandle) {
            const list = map.get(f.motherHandle);
            if (list) {
                list.push(f.handle);
            } else {
                map.set(f.motherHandle, [f.handle]);
            }
        }
    }
    return map;
}
