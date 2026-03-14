/**
 * Vietnamese Kinship Addressing System (Xưng hô Việt Nam)
 *
 * Determines how two people in the family tree should address each other
 * based on generation gap, gender, patrilineal/matrilineal path, and birth order.
 */
import type { TreeNode, TreeFamily } from './tree-layout';

// ═══ Types ═══

export interface KinshipResult {
    /** How person A addresses person B */
    aCallsB: string;
    /** How person B addresses person A */
    bCallsA: string;
    /** Relationship description */
    relationship: string;
    /** Path from A to B through the tree */
    path: PathStep[];
    /** Generation difference (positive = B is younger) */
    generationGap: number;
}

export interface PathStep {
    personId: string;
    personName: string;
    gender: number;
    edgeType?: 'parent' | 'child' | 'spouse';
}

// ═══ BFS: Find shortest path between two people ═══

interface BFSEdge {
    to: string;
    type: 'parent' | 'child' | 'spouse';
}

function buildAdjacencyList(
    people: TreeNode[],
    families: TreeFamily[],
): Map<string, BFSEdge[]> {
    const adj = new Map<string, BFSEdge[]>();
    for (const p of people) {
        if (!adj.has(p.id)) adj.set(p.id, []);
    }

    for (const fam of families) {
        const parentIds: string[] = [];
        if (fam.fatherId) parentIds.push(fam.fatherId);
        if (fam.motherId) parentIds.push(fam.motherId);

        // Spouse edges
        if (fam.fatherId && fam.motherId) {
            adj.get(fam.fatherId)?.push({ to: fam.motherId, type: 'spouse' });
            adj.get(fam.motherId)?.push({ to: fam.fatherId, type: 'spouse' });
        }

        // Parent-child edges
        for (const childId of fam.childIds) {
            for (const parentId of parentIds) {
                adj.get(parentId)?.push({ to: childId, type: 'child' });
                adj.get(childId)?.push({ to: parentId, type: 'parent' });
            }
        }
    }

    return adj;
}

function findPath(
    fromId: string,
    toId: string,
    people: TreeNode[],
    families: TreeFamily[],
): PathStep[] | null {
    if (fromId === toId) return [];

    const adj = buildAdjacencyList(people, families);
    const personMap = new Map(people.map(p => [p.id, p]));

    const visited = new Set<string>();
    const prev = new Map<string, { from: string; edgeType: 'parent' | 'child' | 'spouse' }>();
    const queue: string[] = [fromId];
    visited.add(fromId);

    while (queue.length > 0) {
        const current = queue.shift()!;
        if (current === toId) break;

        const edges = adj.get(current) || [];
        for (const edge of edges) {
            if (!visited.has(edge.to)) {
                visited.add(edge.to);
                prev.set(edge.to, { from: current, edgeType: edge.type });
                queue.push(edge.to);
            }
        }
    }

    if (!prev.has(toId) && fromId !== toId) return null;

    // Reconstruct path
    const path: PathStep[] = [];
    let current = toId;
    while (current !== fromId) {
        const info = prev.get(current)!;
        const person = personMap.get(current);
        path.unshift({
            personId: current,
            personName: person?.displayName || current,
            gender: person?.gender || 1,
            edgeType: info.edgeType,
        });
        current = info.from;
    }

    // Add the starting person
    const startPerson = personMap.get(fromId);
    path.unshift({
        personId: fromId,
        personName: startPerson?.displayName || fromId,
        gender: startPerson?.gender || 1,
    });

    return path;
}

// ═══ Analyze path to determine relationship ═══

interface RelationshipInfo {
    /** Steps going UP from A to LCA */
    stepsUp: number;
    /** Steps going DOWN from LCA to B */
    stepsDown: number;
    /** Whether the connection goes through a spouse edge */
    throughSpouse: boolean;
    /** Whether the path goes through paternal (nội) or maternal (ngoại) side */
    isPaternal: boolean;
    /** The common ancestor (LCA) handle if exists */
    lcaId?: string;
    /** Whether A and B share the same parents */
    sameFather: boolean;
    sameMother: boolean;
    /** Whether A is older than B (for siblings) */
    aIsOlder: boolean;
}

function analyzeRelationship(
    path: PathStep[],
    personA: TreeNode,
    personB: TreeNode,
    people: TreeNode[],
    families: TreeFamily[],
): RelationshipInfo {
    if (path.length <= 1) {
        return { stepsUp: 0, stepsDown: 0, throughSpouse: false, isPaternal: true, sameFather: false, sameMother: false, aIsOlder: false };
    }

    let stepsUp = 0;
    let stepsDown = 0;
    let goingUp = true;
    let throughSpouse = false;
    let lcaId: string | undefined;

    // Walk the path: first count "parent" edges (going up), then "child" edges (going down)
    for (let i = 1; i < path.length; i++) {
        const edge = path[i].edgeType;
        if (edge === 'spouse') {
            throughSpouse = true;
            continue;
        }
        if (edge === 'parent') {
            if (!goingUp) {
                // Going up again after going down means complex path
                stepsUp++;
            } else {
                stepsUp++;
            }
        } else if (edge === 'child') {
            if (goingUp) {
                goingUp = false;
                lcaId = path[i - 1].personId;
            }
            stepsDown++;
        }
    }

    if (goingUp && stepsUp > 0) {
        // Never went down - B is an ancestor of A
        lcaId = path[path.length - 1].personId;
    }

    // Determine if paternal (nội) or maternal (ngoại)
    // Walk path from A toward LCA, skip spouse edges, find first parent
    let isPaternal = true;
    for (let i = 1; i < path.length; i++) {
        if (path[i].edgeType === 'spouse') continue;
        if (path[i].edgeType === 'parent') {
            const parentPerson = people.find(p => p.id === path[i].personId);
            if (parentPerson) {
                // Use gender + isPatrilineal for accurate nội/ngoại:
                // - Female parent → maternal side (ngoại), even if she's patrilineal
                //   (con gái chính tộc lấy chồng → con của cô ấy là ngoại tộc)
                // - Male parent who is NOT patrilineal (married in) → also ngoại
                //   (the main family connection is through the other parent)
                if (parentPerson.gender === 2 || !parentPerson.isPatrilineal) {
                    isPaternal = false;
                }
            }
        }
        break;
    }

    // Check same parents
    let sameFather = false;
    let sameMother = false;
    for (const fam of families) {
        const aIsChild = fam.childIds.includes(personA.id);
        const bIsChild = fam.childIds.includes(personB.id);
        if (aIsChild && bIsChild) {
            if (fam.fatherId) sameFather = true;
            if (fam.motherId) sameMother = true;
        }
    }

    // Determine who is older
    // Priority: birthOrder (explicit) > birthYear > children array position
    let aIsOlder = false;
    if (sameFather || sameMother) {
        // Same parents — check birthOrder first (most reliable)
        if (personA.birthOrder != null && personB.birthOrder != null) {
            aIsOlder = personA.birthOrder < personB.birthOrder;
        } else if (personA.birthYear && personB.birthYear && personA.birthYear !== personB.birthYear) {
            aIsOlder = personA.birthYear < personB.birthYear;
        } else {
            // Fallback: use position in children array
            for (const fam of families) {
                if (fam.childIds.includes(personA.id) && fam.childIds.includes(personB.id)) {
                    aIsOlder = fam.childIds.indexOf(personA.id) < fam.childIds.indexOf(personB.id);
                    break;
                }
            }
        }
    } else {
        // Not same parents (cousins, etc.) — use birthOrder or birthYear
        if (personA.birthOrder != null && personB.birthOrder != null) {
            aIsOlder = personA.birthOrder < personB.birthOrder;
        } else if (personA.birthYear && personB.birthYear) {
            aIsOlder = personA.birthYear < personB.birthYear;
        }
    }

    return {
        stepsUp,
        stepsDown,
        throughSpouse,
        isPaternal,
        lcaId,
        sameFather,
        sameMother,
        aIsOlder,
    };
}

// ═══ Helper: Determine branch seniority from LCA ═══

/**
 * For collateral (same-generation) relationships, determine seniority
 * by comparing which branch of the LCA (common ancestor) is senior.
 *
 * Vietnamese rule: if LCA's child on A's side is older than LCA's child on B's side,
 * then ALL descendants of A's branch are senior to ALL descendants of B's branch.
 * This cascades regardless of actual birth years of the individuals.
 */
function determineBranchSeniority(
    path: PathStep[],
    lcaId: string | undefined,
    people: TreeNode[],
    families: TreeFamily[],
    fallback: boolean,
): boolean {
    if (!lcaId) return fallback;

    // Find LCA index in path
    let lcaIdx = -1;
    for (let i = 0; i < path.length; i++) {
        if (path[i].personId === lcaId) {
            lcaIdx = i;
            break;
        }
    }
    if (lcaIdx <= 0 || lcaIdx >= path.length - 1) return fallback;

    // Collect all handles on A's side (before LCA) and B's side (after LCA)
    const aSideHandles = new Set<string>();
    for (let i = 0; i < lcaIdx; i++) {
        aSideHandles.add(path[i].personId);
    }
    const bSideHandles = new Set<string>();
    for (let i = lcaIdx + 1; i < path.length; i++) {
        bSideHandles.add(path[i].personId);
    }

    // Find which of LCA's children are on each side
    let childAHandle: string | null = null;
    let childBHandle: string | null = null;

    for (const fam of families) {
        if (fam.fatherId === lcaId || fam.motherId === lcaId) {
            for (const ch of fam.childIds) {
                if (!childAHandle && aSideHandles.has(ch)) childAHandle = ch;
                if (!childBHandle && bSideHandles.has(ch)) childBHandle = ch;
            }
        }
    }

    if (!childAHandle || !childBHandle || childAHandle === childBHandle) return fallback;

    const childA = people.find(p => p.id === childAHandle);
    const childB = people.find(p => p.id === childBHandle);
    if (!childA || !childB) return fallback;

    // Compare the two children of LCA
    if (childA.birthOrder != null && childB.birthOrder != null) {
        return childA.birthOrder < childB.birthOrder;
    }
    if (childA.birthYear && childB.birthYear && childA.birthYear !== childB.birthYear) {
        return childA.birthYear < childB.birthYear;
    }
    // Fallback: position in shared family's children array
    for (const fam of families) {
        const aIdx = fam.childIds.indexOf(childAHandle!);
        const bIdx = fam.childIds.indexOf(childBHandle!);
        if (aIdx >= 0 && bIdx >= 0) {
            return aIdx < bIdx;
        }
    }
    return fallback;
}

// ═══ Helper: Compare seniority between two siblings ═══
// Priority: birthOrder > birthYear > childIds position
function compareSeniority(
    personX: TreeNode,
    personY: TreeNode | null | undefined,
    families: TreeFamily[],
): boolean {
    if (!personY) return false;
    if (personX.birthOrder != null && personY.birthOrder != null) {
        return personX.birthOrder < personY.birthOrder;
    }
    if (personX.birthYear && personY.birthYear && personX.birthYear !== personY.birthYear) {
        return personX.birthYear < personY.birthYear;
    }
    // Fallback: position in shared family's children array (thứ tự con)
    for (const fam of families) {
        const xIdx = fam.childIds.indexOf(personX.id);
        const yIdx = fam.childIds.indexOf(personY.id);
        if (xIdx >= 0 && yIdx >= 0) {
            return xIdx < yIdx;
        }
    }
    return false;
}

// ═══ Vietnamese Kinship Terms ═══

/**
 * Determine how person A should address person B
 * and how person B should address person A.
 *
 * generationGap = A's generation - B's generation
 *   positive → B is in a higher generation (B is elder)
 *   negative → B is in a lower generation (B is junior)
 */
function getKinshipTerms(
    personA: TreeNode,
    personB: TreeNode,
    info: RelationshipInfo,
    path: PathStep[],
    people: TreeNode[],
    families: TreeFamily[],
): { aCallsB: string; bCallsA: string; relationship: string } {
    const { stepsUp, stepsDown, throughSpouse, isPaternal, sameFather, sameMother, aIsOlder } = info;

    const genderB = personB.gender; // 1=male, 2=female
    const genderA = personA.gender;

    // ═══ SPOUSE ═══
    if (stepsUp === 0 && stepsDown === 0 && throughSpouse) {
        if (genderA === 1) {
            return { aCallsB: 'Vợ / Em / Mình', bCallsA: 'Chồng / Anh / Mình', relationship: 'Vợ chồng' };
        } else {
            return { aCallsB: 'Chồng / Anh / Mình', bCallsA: 'Vợ / Em / Mình', relationship: 'Vợ chồng' };
        }
    }

    // ═══ DIRECT LINE (trực hệ) — only up or only down ═══
    if (stepsDown === 0 && stepsUp > 0) {
        // B is an ancestor of A (A goes UP to reach B)
        return getAncestorTerms(stepsUp, genderA, genderB, isPaternal, throughSpouse);
    }

    if (stepsUp === 0 && stepsDown > 0) {
        // B is a descendant of A (A goes DOWN to reach B)
        return getDescendantTerms(stepsDown, genderA, genderB, isPaternal, throughSpouse);
    }

    // ═══ COLLATERAL (cùng họ hàng) — up then down ═══

    // Siblings: 1 up, 1 down
    if (stepsUp === 1 && stepsDown === 1) {
        return getSiblingTerms(personA, personB, sameFather, sameMother, aIsOlder, isPaternal);
    }

    // Uncle/Aunt - Nephew/Niece: asymmetric
    if (stepsUp === 1 && stepsDown === 2) {
        // A is uncle/aunt, B is nephew/niece
        // Find B's parent (sibling of A) = child of LCA on B's side
        const lcaIdx = info.lcaId ? path.findIndex(p => p.personId === info.lcaId) : -1;
        const siblingOfA = lcaIdx >= 0 && lcaIdx < path.length - 1
            ? people.find(p => p.id === path[lcaIdx + 1].personId) : null;
        const aIsOlderThanSibling = compareSeniority(personA, siblingOfA, families);
        return getUncleNieceTerms(genderA, genderB, isPaternal, aIsOlderThanSibling, false);
    }

    if (stepsUp === 2 && stepsDown === 1) {
        // B is uncle/aunt of A
        // Find A's parent (sibling of B) = child of LCA on A's side
        const lcaIdx = info.lcaId ? path.findIndex(p => p.personId === info.lcaId) : -1;
        const siblingOfB = lcaIdx > 0
            ? people.find(p => p.id === path[lcaIdx - 1].personId) : null;
        const uncleIsOlderThanSibling = compareSeniority(personB, siblingOfB, families);
        return getUncleNieceTerms(genderB, genderA, isPaternal, uncleIsOlderThanSibling, true);
    }

    // Cousins & same-generation collateral: seniority by LCA branch
    // IMPORTANT: Seniority is determined by comparing LCA's children on each side,
    // NOT by the individuals' own age. This cascades through all generations.
    // E.g. if grandfather's first son → father → Hải, and grandfather's second son → uncle → cousin,
    // then Hải is "anh" of cousin regardless of actual birth years.
    if (stepsUp === 2 && stepsDown === 2) {
        const branchAIsOlder = determineBranchSeniority(path, info.lcaId, people, families, aIsOlder);
        return getCousinTerms(personA, personB, branchAIsOlder, isPaternal);
    }

    // Great uncle/aunt: stepsUp=1, stepsDown=3 or stepsUp=3, stepsDown=1
    if (stepsUp === 1 && stepsDown >= 3) {
        const genGap = stepsDown - stepsUp;
        return getDistantRelationTerms(genGap, genderA, genderB, 'A_is_senior', isPaternal);
    }
    if (stepsUp >= 3 && stepsDown === 1) {
        const genGap = stepsUp - stepsDown;
        return getDistantRelationTerms(genGap, genderA, genderB, 'B_is_senior', isPaternal);
    }

    // General case: generalized generation gap
    const genGap = stepsUp - stepsDown;
    if (genGap > 0) {
        // B is senior (higher generation)
        if (genGap === 1) {
            // 1 generation gap — distant uncle/aunt type
            // Use branch seniority from LCA to determine Bác vs Chú/Cô/Cậu/Dì
            const branchAIsOlder = determineBranchSeniority(path, info.lcaId, people, families, false);
            // branchAIsOlder → A's branch is from older child of LCA → B's branch is younger → Chú/Cô
            // !branchAIsOlder → B's branch is from older child of LCA → Bác
            const bBranchIsOlder = !branchAIsOlder;
            if (isPaternal) {
                if (genderB === 1) {
                    const title = bBranchIsOlder ? 'Bác' : 'Chú';
                    return { aCallsB: title, bCallsA: 'Cháu', relationship: `${title} họ — Cháu` };
                } else {
                    const title = bBranchIsOlder ? 'Bác' : 'Cô';
                    return { aCallsB: title, bCallsA: 'Cháu', relationship: `${title} họ — Cháu` };
                }
            } else {
                if (genderB === 1) {
                    return { aCallsB: 'Cậu', bCallsA: 'Cháu', relationship: 'Cậu họ — Cháu' };
                } else {
                    const title = bBranchIsOlder ? 'Bác' : 'Dì';
                    return { aCallsB: title, bCallsA: 'Cháu', relationship: `${title} họ — Cháu` };
                }
            }
        }
        return getDistantRelationTerms(genGap, genderA, genderB, 'B_is_senior', isPaternal);
    } else if (genGap < 0) {
        // A is senior (higher generation)
        if (genGap === -1) {
            // 1 generation gap — A is distant uncle/aunt type
            const branchAIsOlder = determineBranchSeniority(path, info.lcaId, people, families, true);
            // branchAIsOlder → A's branch is from older child of LCA → A is "Bác"
            // !branchAIsOlder → A's branch is from younger child → A is "Chú/Cô/Cậu/Dì"
            if (isPaternal) {
                if (genderA === 1) {
                    const title = branchAIsOlder ? 'Bác' : 'Chú';
                    return { aCallsB: 'Cháu', bCallsA: title, relationship: `${title} họ — Cháu` };
                } else {
                    const title = branchAIsOlder ? 'Bác' : 'Cô';
                    return { aCallsB: 'Cháu', bCallsA: title, relationship: `${title} họ — Cháu` };
                }
            } else {
                if (genderA === 1) {
                    return { aCallsB: 'Cháu', bCallsA: 'Cậu', relationship: 'Cậu họ — Cháu' };
                } else {
                    const title = branchAIsOlder ? 'Bác' : 'Dì';
                    return { aCallsB: 'Cháu', bCallsA: title, relationship: `${title} họ — Cháu` };
                }
            }
        }
        return getDistantRelationTerms(-genGap, genderA, genderB, 'A_is_senior', isPaternal);
    } else {
        // Same generation, distant — determine seniority from LCA branch
        const branchAIsOlder = determineBranchSeniority(path, info.lcaId, people, families, aIsOlder);
        return getCousinTerms(personA, personB, branchAIsOlder, isPaternal);
    }
}

// ═══ Helper: Ancestor terms ═══
function getAncestorTerms(
    stepsUp: number,
    genderA: number,
    genderB: number,
    isPaternal: boolean,
    throughSpouse: boolean,
): { aCallsB: string; bCallsA: string; relationship: string } {
    const side = isPaternal ? 'nội' : 'ngoại';

    if (stepsUp === 1) {
        if (throughSpouse) {
            // A is child-in-law, B is parent-in-law
            const inLawSuffix = genderA === 1 ? 'rể' : 'dâu';
            const inLawParent = genderA === 1 ? 'vợ' : 'chồng';
            if (genderB === 1) {
                return { aCallsB: `Bố ${inLawParent}`, bCallsA: `Con ${inLawSuffix}`, relationship: `Bố ${inLawParent} — Con ${inLawSuffix}` };
            }
            return { aCallsB: `Mẹ ${inLawParent}`, bCallsA: `Con ${inLawSuffix}`, relationship: `Mẹ ${inLawParent} — Con ${inLawSuffix}` };
        }
        if (genderB === 1) {
            return { aCallsB: 'Bố / Ba', bCallsA: 'Con', relationship: 'Cha — Con' };
        }
        return { aCallsB: 'Mẹ / Má', bCallsA: 'Con', relationship: 'Mẹ — Con' };
    }

    if (stepsUp === 2) {
        if (genderB === 1) {
            return { aCallsB: `Ông ${side}`, bCallsA: 'Cháu', relationship: `Ông ${side} — Cháu` };
        }
        return { aCallsB: `Bà ${side}`, bCallsA: 'Cháu', relationship: `Bà ${side} — Cháu` };
    }

    if (stepsUp === 3) {
        if (genderB === 1) {
            return { aCallsB: `Cụ ông ${side}`, bCallsA: 'Chắt', relationship: `Cụ ${side} — Chắt` };
        }
        return { aCallsB: `Cụ bà ${side}`, bCallsA: 'Chắt', relationship: `Cụ ${side} — Chắt` };
    }

    if (stepsUp === 4) {
        if (genderB === 1) {
            return { aCallsB: `Kỵ ông ${side}`, bCallsA: 'Chút', relationship: `Kỵ ${side} — Chút` };
        }
        return { aCallsB: `Kỵ bà ${side}`, bCallsA: 'Chút', relationship: `Kỵ ${side} — Chút` };
    }

    // Very distant ancestor (5+ generations)
    const prefix = genderB === 1 ? 'Ông' : 'Bà';
    const genWord = stepsUp === 5 ? 'Tổ' : `Tổ ${stepsUp} đời`;
    return { aCallsB: `${prefix} ${genWord} ${side}`, bCallsA: `Hậu duệ đời ${stepsUp}`, relationship: `Tổ tiên đời ${stepsUp} (${side})` };
}

// ═══ Helper: Descendant terms ═══
function getDescendantTerms(
    stepsDown: number,
    genderA: number,
    genderB: number,
    isPaternal: boolean,
    throughSpouse: boolean,
): { aCallsB: string; bCallsA: string; relationship: string } {
    const side = isPaternal ? 'nội' : 'ngoại';

    // In-law descendants (con dâu/rể, cháu dâu/rể, ...)
    if (throughSpouse) {
        const inLawSuffix = genderB === 1 ? 'rể' : 'dâu';
        const inLawParent = genderB === 1 ? 'vợ' : 'chồng';
        if (stepsDown === 1) {
            const label = `Con ${inLawSuffix}`;
            if (genderA === 1) {
                return { aCallsB: label, bCallsA: `Bố ${inLawParent}`, relationship: `Cha — ${label}` };
            }
            return { aCallsB: label, bCallsA: `Mẹ ${inLawParent}`, relationship: `Mẹ — ${label}` };
        }
        if (stepsDown === 2) {
            const label = `Cháu ${inLawSuffix}`;
            const title = genderA === 1 ? `Ông ${side}` : `Bà ${side}`;
            return { aCallsB: label, bCallsA: title, relationship: `${title} — ${label}` };
        }
        if (stepsDown === 3) {
            const label = `Chắt ${inLawSuffix}`;
            const title = genderA === 1 ? `Cụ ông ${side}` : `Cụ bà ${side}`;
            return { aCallsB: label, bCallsA: title, relationship: `Cụ ${side} — ${label}` };
        }
        if (stepsDown === 4) {
            const label = `Chút ${inLawSuffix}`;
            const title = genderA === 1 ? `Kỵ ông ${side}` : `Kỵ bà ${side}`;
            return { aCallsB: label, bCallsA: title, relationship: `Kỵ ${side} — ${label}` };
        }
        return { aCallsB: `Hậu duệ ${inLawSuffix} đời ${stepsDown}`, bCallsA: 'Tổ tiên', relationship: `Tổ tiên — Hậu duệ ${inLawSuffix} đời ${stepsDown}` };
    }

    if (stepsDown === 1) {
        if (genderA === 1) {
            return { aCallsB: 'Con', bCallsA: 'Bố / Ba', relationship: 'Cha — Con' };
        }
        return { aCallsB: 'Con', bCallsA: 'Mẹ / Má', relationship: 'Mẹ — Con' };
    }

    if (stepsDown === 2) {
        const title = genderA === 1 ? `Ông ${side}` : `Bà ${side}`;
        return { aCallsB: 'Cháu', bCallsA: title, relationship: `${title} — Cháu` };
    }

    if (stepsDown === 3) {
        const title = genderA === 1 ? `Cụ ông ${side}` : `Cụ bà ${side}`;
        return { aCallsB: 'Chắt', bCallsA: title, relationship: `Cụ ${side} — Chắt` };
    }

    if (stepsDown === 4) {
        const title = genderA === 1 ? `Kỵ ông ${side}` : `Kỵ bà ${side}`;
        return { aCallsB: 'Chút', bCallsA: title, relationship: `Kỵ ${side} — Chút` };
    }

    return { aCallsB: `Hậu duệ đời ${stepsDown}`, bCallsA: 'Tổ tiên', relationship: `Tổ tiên — Hậu duệ đời ${stepsDown} (${side})` };
}

// ═══ Helper: Sibling terms ═══
function getSiblingTerms(
    personA: TreeNode,
    personB: TreeNode,
    sameFather: boolean,
    sameMother: boolean,
    aIsOlder: boolean,
    _isPaternal: boolean,
): { aCallsB: string; bCallsA: string; relationship: string } {
    const sameParents = sameFather && sameMother;
    const halfSibling = (sameFather || sameMother) && !sameParents;
    const suffix = halfSibling ? ' (cùng cha khác mẹ)' : sameParents ? ' (ruột)' : ' (họ)';

    if (aIsOlder) {
        // A is older → A calls B "Em trai" or "Em gái"
        const emB = personB.gender === 1 ? 'Em trai' : 'Em gái';
        const emA = personA.gender === 1 ? 'Em trai' : 'Em gái';
        const bCallsA = personA.gender === 1 ? 'Anh' : 'Chị';
        const relationship = personA.gender === 1
            ? (personB.gender === 1 ? `Anh em trai${suffix}` : `Anh em gái${suffix}`)
            : (personB.gender === 2 ? `Chị em gái${suffix}` : `Chị em trai${suffix}`);
        return { aCallsB: emB, bCallsA, relationship };
    } else {
        // A is younger → A calls B "Anh" or "Chị"
        const aCallsB = personB.gender === 1 ? 'Anh' : 'Chị';
        const bCallsA = personA.gender === 1 ? 'Em trai' : 'Em gái';
        const relationship = personB.gender === 1
            ? (personA.gender === 1 ? `Anh em trai${suffix}` : `Anh em gái${suffix}`)
            : (personA.gender === 2 ? `Chị em gái${suffix}` : `Chị em trai${suffix}`);
        return { aCallsB, bCallsA, relationship };
    }
}

// ═══ Helper: Uncle/Aunt — Nephew/Niece ═══
function getUncleNieceTerms(
    genderSenior: number,
    _genderJunior: number,
    isPaternal: boolean,
    seniorIsOlderThanParent: boolean,
    reversed: boolean,
): { aCallsB: string; bCallsA: string; relationship: string } {
    let seniorTitle: string;
    let relationship: string;

    if (isPaternal) {
        // Paternal side (bên nội)
        if (genderSenior === 1) {
            seniorTitle = seniorIsOlderThanParent ? 'Bác' : 'Chú';
            relationship = seniorIsOlderThanParent ? 'Bác — Cháu' : 'Chú — Cháu';
        } else {
            seniorTitle = seniorIsOlderThanParent ? 'Bác' : 'Cô';
            relationship = seniorIsOlderThanParent ? 'Bác — Cháu' : 'Cô — Cháu';
        }
    } else {
        // Maternal side (bên ngoại)
        // Nếu anh/chị LỚN HƠN bố/mẹ → luôn gọi "Bác" (cả nam lẫn nữ)
        if (seniorIsOlderThanParent) {
            seniorTitle = 'Bác';
            relationship = 'Bác — Cháu';
        } else if (genderSenior === 1) {
            seniorTitle = 'Cậu';
            relationship = 'Cậu — Cháu';
        } else {
            seniorTitle = 'Dì';
            relationship = 'Dì — Cháu';
        }
    }

    if (reversed) {
        // A is junior, B is senior
        return { aCallsB: seniorTitle, bCallsA: 'Cháu', relationship };
    } else {
        // A is senior, B is junior
        return { aCallsB: 'Cháu', bCallsA: seniorTitle, relationship };
    }
}

// ═══ Helper: Cousin terms ═══
function getCousinTerms(
    personA: TreeNode,
    personB: TreeNode,
    aIsOlder: boolean,
    isPaternal: boolean,
): { aCallsB: string; bCallsA: string; relationship: string } {
    const side = isPaternal ? 'bên nội' : 'bên ngoại';

    if (aIsOlder) {
        // A is older → A calls B "Em trai" or "Em gái"
        const emB = personB.gender === 1 ? 'Em trai' : 'Em gái';
        const bCallsA = personA.gender === 1 ? 'Anh' : 'Chị';
        return { aCallsB: emB, bCallsA, relationship: `Anh chị em họ (${side})` };
    } else {
        // A is younger → A calls B "Anh" or "Chị"
        const aCallsB = personB.gender === 1 ? 'Anh' : 'Chị';
        const bCallsA = personA.gender === 1 ? 'Em trai' : 'Em gái';
        return { aCallsB, bCallsA, relationship: `Anh chị em họ (${side})` };
    }
}

// ═══ Helper: Distant relation terms ═══
function getDistantRelationTerms(
    genGap: number,
    _genderA: number,
    genderB: number,
    whoIsSenior: 'A_is_senior' | 'B_is_senior',
    isPaternal: boolean,
): { aCallsB: string; bCallsA: string; relationship: string } {
    const side = isPaternal ? 'nội' : 'ngoại';

    if (genGap === 1) {
        // One generation difference
        if (whoIsSenior === 'B_is_senior') {
            // B is senior → same as uncle/aunt
            if (isPaternal) {
                const title = genderB === 1 ? 'Chú/Bác' : 'Cô/Bác';
                return { aCallsB: title, bCallsA: 'Cháu', relationship: `${title} họ — Cháu` };
            } else {
                const title = genderB === 1 ? 'Cậu' : 'Dì';
                return { aCallsB: title, bCallsA: 'Cháu', relationship: `${title} họ — Cháu` };
            }
        } else {
            return { aCallsB: 'Cháu', bCallsA: genderB === 1 ? 'Chú/Bác' : 'Cô/Dì', relationship: `Họ hàng chênh 1 đời (${side})` };
        }
    }

    if (genGap === 2) {
        if (whoIsSenior === 'B_is_senior') {
            const title = genderB === 1 ? 'Ông' : 'Bà';
            return { aCallsB: `${title} (họ)`, bCallsA: 'Cháu', relationship: `${title} họ — Cháu (${side})` };
        } else {
            return { aCallsB: 'Cháu', bCallsA: genderB === 1 ? 'Ông (họ)' : 'Bà (họ)', relationship: `Họ hàng chênh 2 đời (${side})` };
        }
    }

    // Very distant
    if (whoIsSenior === 'B_is_senior') {
        return {
            aCallsB: genderB === 1 ? `Ông (họ, ${genGap} đời)` : `Bà (họ, ${genGap} đời)`,
            bCallsA: 'Cháu (họ)',
            relationship: `Họ hàng chênh ${genGap} đời (${side})`,
        };
    } else {
        return {
            aCallsB: 'Cháu (họ)',
            bCallsA: genderB === 1 ? `Ông (họ)` : `Bà (họ)`,
            relationship: `Họ hàng chênh ${genGap} đời (${side})`,
        };
    }
}

// ═══ Main API ═══

export function determineKinship(
    idA: string,
    idB: string,
    people: TreeNode[],
    families: TreeFamily[],
): KinshipResult | null {
    if (idA === idB) {
        const person = people.find(p => p.id === idA);
        return {
            aCallsB: 'Chính mình',
            bCallsA: 'Chính mình',
            relationship: 'Cùng một người',
            path: person ? [{
                personId: person.id,
                personName: person.displayName,
                gender: person.gender,
            }] : [],
            generationGap: 0,
        };
    }

    const path = findPath(idA, idB, people, families);
    if (!path || path.length === 0) {
        return null; // No connection found
    }

    const personA = people.find(p => p.id === idA)!;
    const personB = people.find(p => p.id === idB)!;

    const info = analyzeRelationship(path, personA, personB, people, families);
    const terms = getKinshipTerms(personA, personB, info, path, people, families);

    return {
        aCallsB: terms.aCallsB,
        bCallsA: terms.bCallsA,
        relationship: terms.relationship,
        path,
        generationGap: info.stepsUp - info.stepsDown,
    };
}
