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
    personHandle: string;
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
        if (!adj.has(p.handle)) adj.set(p.handle, []);
    }

    for (const fam of families) {
        const parentHandles: string[] = [];
        if (fam.fatherHandle) parentHandles.push(fam.fatherHandle);
        if (fam.motherHandle) parentHandles.push(fam.motherHandle);

        // Spouse edges
        if (fam.fatherHandle && fam.motherHandle) {
            adj.get(fam.fatherHandle)?.push({ to: fam.motherHandle, type: 'spouse' });
            adj.get(fam.motherHandle)?.push({ to: fam.fatherHandle, type: 'spouse' });
        }

        // Parent-child edges
        for (const childHandle of fam.children) {
            for (const parentHandle of parentHandles) {
                adj.get(parentHandle)?.push({ to: childHandle, type: 'child' });
                adj.get(childHandle)?.push({ to: parentHandle, type: 'parent' });
            }
        }
    }

    return adj;
}

function findPath(
    fromHandle: string,
    toHandle: string,
    people: TreeNode[],
    families: TreeFamily[],
): PathStep[] | null {
    if (fromHandle === toHandle) return [];

    const adj = buildAdjacencyList(people, families);
    const personMap = new Map(people.map(p => [p.handle, p]));

    const visited = new Set<string>();
    const prev = new Map<string, { from: string; edgeType: 'parent' | 'child' | 'spouse' }>();
    const queue: string[] = [fromHandle];
    visited.add(fromHandle);

    while (queue.length > 0) {
        const current = queue.shift()!;
        if (current === toHandle) break;

        const edges = adj.get(current) || [];
        for (const edge of edges) {
            if (!visited.has(edge.to)) {
                visited.add(edge.to);
                prev.set(edge.to, { from: current, edgeType: edge.type });
                queue.push(edge.to);
            }
        }
    }

    if (!prev.has(toHandle) && fromHandle !== toHandle) return null;

    // Reconstruct path
    const path: PathStep[] = [];
    let current = toHandle;
    while (current !== fromHandle) {
        const info = prev.get(current)!;
        const person = personMap.get(current);
        path.unshift({
            personHandle: current,
            personName: person?.displayName || current,
            gender: person?.gender || 1,
            edgeType: info.edgeType,
        });
        current = info.from;
    }

    // Add the starting person
    const startPerson = personMap.get(fromHandle);
    path.unshift({
        personHandle: fromHandle,
        personName: startPerson?.displayName || fromHandle,
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
    lcaHandle?: string;
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
    let lcaHandle: string | undefined;

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
                lcaHandle = path[i - 1].personHandle;
            }
            stepsDown++;
        }
    }

    if (goingUp && stepsUp > 0) {
        // Never went down - B is an ancestor of A
        lcaHandle = path[path.length - 1].personHandle;
    }

    // Determine if paternal or maternal
    // Check if the path from A upward goes through father (paternal) or mother (maternal)
    let isPaternal = true;
    if (path.length > 1 && path[1].edgeType === 'parent') {
        // Check if path[1] is father or mother of A
        const parentHandle = path[1].personHandle;
        const parentPerson = people.find(p => p.handle === parentHandle);
        // If the parent in the path is female → maternal side
        if (parentPerson && parentPerson.gender === 2) {
            isPaternal = false;
        }
    }

    // Check same parents
    let sameFather = false;
    let sameMother = false;
    for (const fam of families) {
        const aIsChild = fam.children.includes(personA.handle);
        const bIsChild = fam.children.includes(personB.handle);
        if (aIsChild && bIsChild) {
            if (fam.fatherHandle) sameFather = true;
            if (fam.motherHandle) sameMother = true;
        }
    }

    // Determine who is older
    let aIsOlder = false;
    if (sameFather || sameMother) {
        // Same parents: use birth year or position in children array
        if (personA.birthYear && personB.birthYear) {
            aIsOlder = personA.birthYear < personB.birthYear;
        } else {
            // Use position in children array
            for (const fam of families) {
                if (fam.children.includes(personA.handle) && fam.children.includes(personB.handle)) {
                    aIsOlder = fam.children.indexOf(personA.handle) < fam.children.indexOf(personB.handle);
                    break;
                }
            }
        }
    } else if (personA.birthYear && personB.birthYear) {
        aIsOlder = personA.birthYear < personB.birthYear;
    }

    return {
        stepsUp,
        stepsDown,
        throughSpouse,
        isPaternal,
        lcaHandle,
        sameFather,
        sameMother,
        aIsOlder,
    };
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
        return getAncestorTerms(stepsUp, genderB, isPaternal, throughSpouse);
    }

    if (stepsUp === 0 && stepsDown > 0) {
        // B is a descendant of A (A goes DOWN to reach B)
        return getDescendantTerms(stepsDown, genderA, isPaternal, throughSpouse);
    }

    // ═══ COLLATERAL (cùng họ hàng) — up then down ═══

    // Siblings: 1 up, 1 down
    if (stepsUp === 1 && stepsDown === 1) {
        return getSiblingTerms(personA, personB, sameFather, sameMother, aIsOlder, isPaternal);
    }

    // Uncle/Aunt - Nephew/Niece: asymmetric
    if (stepsUp === 1 && stepsDown === 2) {
        // A is uncle/aunt, B is nephew/niece
        // Path: A→parent(LCA)→sibling_of_A(B's parent)→B
        // Need to compare A with B's parent (the sibling of A) to determine Bác vs Chú/Cô
        const parentOfB = path.length >= 3 ? people.find(p => p.handle === path[path.length - 2].personHandle) : null;
        let aIsOlderThanParentOfB = false;
        if (parentOfB && personA.birthYear && parentOfB.birthYear) {
            aIsOlderThanParentOfB = personA.birthYear < parentOfB.birthYear;
        } else if (parentOfB) {
            for (const fam of families) {
                const aIdx = fam.children.indexOf(personA.handle);
                const pIdx = fam.children.indexOf(parentOfB.handle);
                if (aIdx >= 0 && pIdx >= 0) {
                    aIsOlderThanParentOfB = aIdx < pIdx;
                    break;
                }
            }
        }
        return getUncleNieceTerms(genderA, genderB, isPaternal, aIsOlderThanParentOfB, false);
    }

    if (stepsUp === 2 && stepsDown === 1) {
        // B is uncle/aunt of A
        // A is nephew/niece, B is uncle/aunt
        // Need to compare B with A's parent (the sibling of B) to determine Bác vs Chú/Cô
        const parentOfA = path.length >= 2 ? people.find(p => p.handle === path[1].personHandle) : null;
        let uncleIsOlderThanParent = false;
        if (parentOfA && personB.birthYear && parentOfA.birthYear) {
            uncleIsOlderThanParent = personB.birthYear < parentOfA.birthYear;
        } else if (parentOfA) {
            // Fallback: check children array order in shared family
            for (const fam of families) {
                const bIdx = fam.children.indexOf(personB.handle);
                const pIdx = fam.children.indexOf(parentOfA.handle);
                if (bIdx >= 0 && pIdx >= 0) {
                    uncleIsOlderThanParent = bIdx < pIdx;
                    break;
                }
            }
        }
        const reverse = getUncleNieceTerms(genderB, genderA, isPaternal, uncleIsOlderThanParent, true);
        return reverse;
    }

    // Cousins: 2 up, 2 down (same generation, grandparent is LCA)
    if (stepsUp === 2 && stepsDown === 2) {
        return getCousinTerms(personA, personB, aIsOlder, isPaternal);
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
        return getDistantRelationTerms(genGap, genderA, genderB, 'B_is_senior', isPaternal);
    } else if (genGap < 0) {
        // A is senior
        return getDistantRelationTerms(-genGap, genderA, genderB, 'A_is_senior', isPaternal);
    } else {
        // Same generation, distant
        return getCousinTerms(personA, personB, aIsOlder, isPaternal);
    }
}

// ═══ Helper: Ancestor terms ═══
function getAncestorTerms(
    stepsUp: number,
    genderB: number,
    isPaternal: boolean,
    throughSpouse: boolean,
): { aCallsB: string; bCallsA: string; relationship: string } {
    const side = isPaternal ? 'nội' : 'ngoại';

    if (stepsUp === 1) {
        if (throughSpouse) {
            // B is parent-in-law
            if (genderB === 1) {
                return { aCallsB: `Bố (${side})`, bCallsA: 'Con', relationship: `Bố ${side} — Con` };
            }
            return { aCallsB: `Mẹ (${side})`, bCallsA: 'Con', relationship: `Mẹ ${side} — Con` };
        }
        if (genderB === 1) {
            return { aCallsB: isPaternal ? 'Bố / Ba' : 'Bố / Ba', bCallsA: 'Con', relationship: 'Cha — Con' };
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
            return { aCallsB: `Cụ ông ${side}`, bCallsA: 'Chắt', relationship: `Cụ — Chắt` };
        }
        return { aCallsB: `Cụ bà ${side}`, bCallsA: 'Chắt', relationship: `Cụ — Chắt` };
    }

    if (stepsUp === 4) {
        if (genderB === 1) {
            return { aCallsB: `Kỵ ông`, bCallsA: 'Chút', relationship: `Kỵ — Chút` };
        }
        return { aCallsB: `Kỵ bà`, bCallsA: 'Chút', relationship: `Kỵ — Chút` };
    }

    // Very distant ancestor (5+ generations)
    const prefix = genderB === 1 ? 'Ông' : 'Bà';
    const genWord = stepsUp === 5 ? 'Tổ' : `Tổ ${stepsUp} đời`;
    return { aCallsB: `${prefix} ${genWord}`, bCallsA: `Hậu duệ đời ${stepsUp}`, relationship: `Tổ tiên đời ${stepsUp}` };
}

// ═══ Helper: Descendant terms ═══
function getDescendantTerms(
    stepsDown: number,
    genderA: number,
    _isPaternal: boolean,
    _throughSpouse: boolean,
): { aCallsB: string; bCallsA: string; relationship: string } {
    if (stepsDown === 1) {
        if (genderA === 1) {
            return { aCallsB: 'Con', bCallsA: 'Bố / Ba', relationship: 'Cha — Con' };
        }
        return { aCallsB: 'Con', bCallsA: 'Mẹ / Má', relationship: 'Mẹ — Con' };
    }

    if (stepsDown === 2) {
        if (genderA === 1) {
            return { aCallsB: 'Cháu', bCallsA: 'Ông', relationship: 'Ông — Cháu' };
        }
        return { aCallsB: 'Cháu', bCallsA: 'Bà', relationship: 'Bà — Cháu' };
    }

    if (stepsDown === 3) {
        if (genderA === 1) {
            return { aCallsB: 'Chắt', bCallsA: 'Cụ ông', relationship: 'Cụ — Chắt' };
        }
        return { aCallsB: 'Chắt', bCallsA: 'Cụ bà', relationship: 'Cụ — Chắt' };
    }

    if (stepsDown === 4) {
        if (genderA === 1) {
            return { aCallsB: 'Chút', bCallsA: 'Kỵ ông', relationship: 'Kỵ — Chút' };
        }
        return { aCallsB: 'Chút', bCallsA: 'Kỵ bà', relationship: 'Kỵ — Chút' };
    }

    return { aCallsB: `Hậu duệ đời ${stepsDown}`, bCallsA: 'Tổ tiên', relationship: `Tổ tiên — Hậu duệ đời ${stepsDown}` };
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
        // A is older
        if (personB.gender === 1) {
            return {
                aCallsB: 'Em',
                bCallsA: personA.gender === 1 ? 'Anh' : 'Chị',
                relationship: `${personA.gender === 1 ? 'Anh' : 'Chị'} em${suffix}`,
            };
        } else {
            return {
                aCallsB: 'Em',
                bCallsA: personA.gender === 1 ? 'Anh' : 'Chị',
                relationship: `${personA.gender === 1 ? 'Anh' : 'Chị'} em${suffix}`,
            };
        }
    } else {
        // A is younger
        if (personB.gender === 1) {
            return {
                aCallsB: 'Anh',
                bCallsA: personA.gender === 1 ? 'Em' : 'Em',
                relationship: `Anh em${suffix}`,
            };
        } else {
            return {
                aCallsB: 'Chị',
                bCallsA: 'Em',
                relationship: `Chị em${suffix}`,
            };
        }
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
        if (genderSenior === 1) {
            seniorTitle = 'Cậu';
            relationship = 'Cậu — Cháu';
        } else {
            seniorTitle = seniorIsOlderThanParent ? 'Bác' : 'Dì';
            relationship = seniorIsOlderThanParent ? 'Bác — Cháu' : 'Dì — Cháu';
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
        if (personB.gender === 1) {
            return {
                aCallsB: 'Em',
                bCallsA: personA.gender === 1 ? 'Anh' : 'Chị',
                relationship: `Anh chị em họ (${side})`,
            };
        } else {
            return {
                aCallsB: 'Em',
                bCallsA: personA.gender === 1 ? 'Anh' : 'Chị',
                relationship: `Anh chị em họ (${side})`,
            };
        }
    } else {
        if (personB.gender === 1) {
            return {
                aCallsB: 'Anh',
                bCallsA: 'Em',
                relationship: `Anh chị em họ (${side})`,
            };
        } else {
            return {
                aCallsB: 'Chị',
                bCallsA: 'Em',
                relationship: `Anh chị em họ (${side})`,
            };
        }
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
    handleA: string,
    handleB: string,
    people: TreeNode[],
    families: TreeFamily[],
): KinshipResult | null {
    if (handleA === handleB) {
        const person = people.find(p => p.handle === handleA);
        return {
            aCallsB: 'Chính mình',
            bCallsA: 'Chính mình',
            relationship: 'Cùng một người',
            path: person ? [{
                personHandle: person.handle,
                personName: person.displayName,
                gender: person.gender,
            }] : [],
            generationGap: 0,
        };
    }

    const path = findPath(handleA, handleB, people, families);
    if (!path || path.length === 0) {
        return null; // No connection found
    }

    const personA = people.find(p => p.handle === handleA)!;
    const personB = people.find(p => p.handle === handleB)!;

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
