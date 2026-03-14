'use client';

import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { ContributeDialog } from '@/components/contribute-dialog';
import { Search, ZoomIn, ZoomOut, Maximize2, TreePine, Eye, Users, GitBranch, User, ArrowDownToLine, ArrowUpFromLine, Crosshair, X, ChevronDown, ChevronRight, BarChart3, Package, Link, ChevronsDownUp, ChevronsUpDown, Copy, Pencil, Save, RotateCcw, Trash2, ArrowUp, ArrowDown, GripVertical, MessageSquarePlus, UserPlus, Phone, Mail, MapPin, Briefcase, GraduationCap, StickyNote, Heart, Baby, GripHorizontal, ArrowLeftRight, Camera } from 'lucide-react';
import { toPng } from 'html-to-image';
import { determineKinship, type KinshipResult } from '@/lib/kinship';
import { PersonDetailPanel } from '@/components/person-detail-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

import {
    fetchTreeData,
    fetchPersonDetail,
    updateFamilyChildren as supaUpdateFamilyChildren,
    moveChildToFamily as supaMoveChild,
    removeChildFromFamily as supaRemoveChild,
    updatePersonLiving as supaUpdatePersonLiving,
    updatePerson as supaUpdatePerson,
    addPerson as supaAddPerson,
    deletePerson as supaDeletePerson,
    addFamily as supaAddFamily,
    updatePersonFamilies as supaUpdatePersonFamilies,
} from '@/lib/supabase-data';
import type { PersonDetail } from '@/lib/genealogy-types';
import { zodiacYear } from '@/lib/genealogy-types';
import {
    computeLayout, filterAncestors, filterDescendants,
    CARD_W, CARD_H,
    type TreeNode, type TreeFamily, type LayoutResult, type PositionedNode, type PositionedCouple, type Connection,
} from '@/lib/tree-layout';
import { getMockTreeData } from '@/lib/mock-data';
import { buildParentToFamiliesMap } from '@/lib/tree-utils';

type ViewMode = 'full' | 'ancestor' | 'descendant';
type ZoomLevel = 'full' | 'compact' | 'mini';

function getZoomLevel(scale: number): ZoomLevel {
    if (scale > 0.6) return 'full';
    if (scale > 0.3) return 'compact';
    return 'mini';
}

// === Branch Summary (F4) ===
interface BranchSummary {
    parentId: string;
    totalDescendants: number;
    generationRange: [number, number];
    livingCount: number;
    deceasedCount: number;
    patrilinealCount: number;
}

function computeBranchSummary(
    handle: string,
    people: TreeNode[],
    families: TreeFamily[],
): BranchSummary {
    const personMap = new Map(people.map(p => [p.id, p]));
    const familyMap = new Map(families.map(f => [f.id, f]));
    const parentFamiliesMap = buildParentToFamiliesMap(families);
    const visited = new Set<string>();
    let livingCount = 0, deceasedCount = 0, patrilinealCount = 0;
    let minGen = Infinity, maxGen = -Infinity;

    function walk(h: string) {
        if (visited.has(h)) return;
        visited.add(h);
        const person = personMap.get(h);
        if (!person) return;
        const gen = person.generation; // actual Đời from data
        if (gen < minGen) minGen = gen;
        if (gen > maxGen) maxGen = gen;
        if (person.isLiving) livingCount++; else deceasedCount++;
        if (person.isPatrilineal) patrilinealCount++;
        for (const fId of (parentFamiliesMap.get(h) || [])) {
            const fam = familyMap.get(fId);
            if (!fam) continue;
            for (const ch of fam.childIds) walk(ch);
        }
    }

    // Walk from this person's children (not including the person itself)
    for (const fId of (parentFamiliesMap.get(handle) || [])) {
        const fam = familyMap.get(fId);
        if (!fam) continue;
        // Also count spouse
        if (fam.motherId && fam.motherId !== handle && !visited.has(fam.motherId)) {
            const spouse = personMap.get(fam.motherId);
            if (spouse) { visited.add(fam.motherId); if (spouse.isLiving) livingCount++; else deceasedCount++; }
        }
        if (fam.fatherId && fam.fatherId !== handle && !visited.has(fam.fatherId)) {
            const spouse = personMap.get(fam.fatherId);
            if (spouse) { visited.add(fam.fatherId); if (spouse.isLiving) livingCount++; else deceasedCount++; }
        }
        for (const ch of fam.childIds) walk(ch);
    }

    return {
        parentId: handle,
        totalDescendants: visited.size,
        generationRange: [minGen === Infinity ? 0 : minGen, maxGen === -Infinity ? 0 : maxGen],
        livingCount, deceasedCount, patrilinealCount,
    };
}

// === Tree Stats (F3) ===
interface TreeStats {
    total: number;
    totalFamilies: number;
    totalGenerations: number;
    perGeneration: { gen: number; count: number }[];
    livingCount: number;
    deceasedCount: number;
    patrilinealCount: number;
    nonPatrilinealCount: number;
    maleCount: number;
    femaleCount: number;
}

function computeTreeStats(nodes: PositionedNode[], families: TreeFamily[]): TreeStats {
    const genMap = new Map<number, number>();
    let living = 0, deceased = 0, patri = 0, nonPatri = 0, male = 0, female = 0;
    for (const n of nodes) {
        const gen = n.node.generation; // actual Đời number from data
        genMap.set(gen, (genMap.get(gen) ?? 0) + 1);
        if (n.node.isLiving) living++; else deceased++;
        if (n.node.isPatrilineal) patri++; else nonPatri++;
        if (n.node.gender === 1) male++; else if (n.node.gender === 2) female++;
    }
    const perGeneration = Array.from(genMap.entries())
        .map(([gen, count]) => ({ gen, count }))
        .sort((a, b) => a.gen - b.gen);
    return {
        total: nodes.length,
        totalFamilies: families.length,
        totalGenerations: perGeneration.length,
        perGeneration,
        livingCount: living,
        deceasedCount: deceased,
        patrilinealCount: patri,
        nonPatrilinealCount: nonPatri,
        maleCount: male,
        femaleCount: female,
    };
}

// Default depth at which branches auto-collapse in panoramic view (0-indexed: gen 3 = Đời 4)
const AUTO_COLLAPSE_GEN = 16;

// Compute generations via BFS from root persons (persons not in any family as children)
function computePersonGenerations(people: TreeNode[], families: TreeFamily[]): Map<string, number> {
    const childOf = new Set<string>();
    for (const f of families) for (const ch of f.childIds) childOf.add(ch);
    const roots = people.filter(p => p.isPatrilineal && !childOf.has(p.id));
    const gens = new Map<string, number>();
    const familyMap = new Map(families.map(f => [f.id, f]));
    const queue: { handle: string; gen: number }[] = roots.map(r => ({ handle: r.id, gen: 0 }));
    while (queue.length > 0) {
        const { handle, gen } = queue.shift()!;
        if (gens.has(handle)) continue;
        gens.set(handle, gen);
        const person = people.find(p => p.id === handle);
        if (!person) continue;
        for (const fId of person.familyIds) {
            const fam = familyMap.get(fId);
            if (!fam) continue;
            // Spouse at same gen
            if (fam.fatherId && !gens.has(fam.fatherId)) gens.set(fam.fatherId, gen);
            if (fam.motherId && !gens.has(fam.motherId)) gens.set(fam.motherId, gen);
            for (const ch of fam.childIds) {
                if (!gens.has(ch)) queue.push({ handle: ch, gen: gen + 1 });
            }
        }
    }
    return gens;
}

export default function TreeViewPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const containerRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);

    const [treeData, setTreeData] = useState<{ people: TreeNode[]; families: TreeFamily[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('full');
    const [focusPerson, setFocusPerson] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
    const [contributePerson, setContributePerson] = useState<{ id: string; name: string } | null>(null);
    const [linkCopied, setLinkCopied] = useState(false);
    const [detailPerson, setDetailPerson] = useState<string | null>(null);

    // F4: Collapsible branches
    const [collapsedBranches, setCollapsedBranches] = useState<Set<string>>(new Set());
    // F3: Stats panel user-hidden
    const [statsHidden, setStatsHidden] = useState(false);

    // Editor mode state
    const [editorMode, setEditorMode] = useState(false);
    const [selectedCard, setSelectedCard] = useState<string | null>(null);
    const { isAdmin, canEdit, isLoggedIn } = useAuth();

    // Export image state
    const [exporting, setExporting] = useState(false);
    const treeContentRef = useRef<HTMLDivElement>(null);

    // Quick add person from context menu
    const [quickAdd, setQuickAdd] = useState<{ person: TreeNode; x: number; y: number } | null>(null);

    // Kinship mode: toolbar toggle, tick-select up to 2 people
    const [kinshipMode, setKinshipMode] = useState(false);
    const [kinshipSelected, setKinshipSelected] = useState<string[]>([]); // max 2 handles
    const [kinshipResult, setKinshipResult] = useState<KinshipResult | null>(null);

    // Drag-and-drop state (editor mode only)
    const [dragState, setDragState] = useState<{
        id: string;
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
    } | null>(null);
    const [dropTarget, setDropTarget] = useState<string | null>(null);

    // Auto-compute kinship when exactly 2 people are selected
    useEffect(() => {
        if (kinshipSelected.length === 2 && treeData) {
            const result = determineKinship(kinshipSelected[0], kinshipSelected[1], treeData.people, treeData.families);
            setKinshipResult(result);
        } else {
            setKinshipResult(null);
        }
    }, [kinshipSelected, treeData]);

    // URL query param initialization + auto-collapse on initial load
    const urlInitialized = useRef(false);
    const initialFocusFromUrl = useRef<string | null>(null);
    const initialViewFromUrl = useRef<string | null>(null);
    useEffect(() => {
        if (urlInitialized.current || !treeData) return;
        urlInitialized.current = true;
        const viewParam = searchParams.get('view') as ViewMode | null;
        const personParam = searchParams.get('person') || searchParams.get('focus');
        // Store initial focus + view for centering effect (before URL sync strips it)
        initialFocusFromUrl.current = personParam;
        initialViewFromUrl.current = viewParam;
        if (viewParam && ['full', 'ancestor', 'descendant'].includes(viewParam)) {
            setViewMode(viewParam);
        }
        if (personParam && treeData.people.some(p => p.id === personParam)) {
            setFocusPerson(personParam);
        }
        // Auto-collapse on initial load
        if (!viewParam || viewParam === 'full') {
            // Panoramic: collapse by absolute generation
            const gens = computePersonGenerations(treeData.people, treeData.families);
            const toCollapse = new Set<string>();
            for (const f of treeData.families) {
                if (f.childIds.length === 0) continue;
                const parentId = f.fatherId || f.motherId;
                if (!parentId) continue;
                const gen = gens.get(parentId);
                if (gen !== undefined && gen >= AUTO_COLLAPSE_GEN) {
                    toCollapse.add(parentId);
                }
            }
            setCollapsedBranches(toCollapse);
        } else if (viewParam === 'descendant' && personParam) {
            // Descendant: collapse by relative depth from focus person
            // Use families TABLE (source of truth), not person.familyIds (denormalized)
            const parentFamiliesMap = buildParentToFamiliesMap(treeData.families);
            const familyMap = new Map(treeData.families.map(f => [f.id, f]));
            const toCollapse = new Set<string>();
            const depthMap = new Map<string, number>();
            const queue: string[] = [personParam];
            depthMap.set(personParam, 0);
            while (queue.length > 0) {
                const h = queue.shift()!;
                const depth = depthMap.get(h)!;
                for (const fId of (parentFamiliesMap.get(h) || [])) {
                    const fam = familyMap.get(fId);
                    if (!fam || fam.childIds.length === 0) continue;
                    if (depth >= AUTO_COLLAPSE_GEN) {
                        toCollapse.add(h);
                    } else {
                        for (const ch of fam.childIds) {
                            if (!depthMap.has(ch)) {
                                depthMap.set(ch, depth + 1);
                                queue.push(ch);
                            }
                        }
                    }
                }
            }
            setCollapsedBranches(toCollapse);
        }
    }, [searchParams, treeData]);

    // Sync URL when view/focus changes
    useEffect(() => {
        if (!urlInitialized.current) return;
        const params = new URLSearchParams();
        if (viewMode !== 'full') params.set('view', viewMode);
        if (focusPerson && viewMode !== 'full') params.set('person', focusPerson);
        const qs = params.toString();
        router.replace(`${pathname}${qs ? '?' + qs : ''}`, { scroll: false });
    }, [viewMode, focusPerson, router]);

    // Transform state
    const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef({ startX: 0, startY: 0, startTx: 0, startTy: 0 });
    const pinchRef = useRef({ initialDist: 0, initialScale: 1 });
    const transformRef = useRef(transform);
    const touchingRef = useRef(false);
    useEffect(() => { transformRef.current = transform; }, [transform]);

    // Fetch data
    useEffect(() => {
        const fetchTree = async () => {
            try {
                const token = localStorage.getItem('accessToken');
                const apiUrl = process.env.NEXT_PUBLIC_API_URL;
                if (token && apiUrl) {
                    const res = await fetch(`${apiUrl}/genealogy/tree`, {
                        headers: { Authorization: `Bearer ${token}` },
                        signal: AbortSignal.timeout(3000),
                    });
                    if (res.ok) {
                        const json = await res.json();
                        setTreeData(json.data);
                        setLoading(false);
                        return;
                    }
                }
            } catch { /* fallback */ }
            // Load from Supabase
            try {
                const data = await fetchTreeData();
                if (data.people.length > 0) {
                    setTreeData(data);
                    setLoading(false);
                    return;
                }
            } catch { /* fallback to mock */ }
            // Fallback: use bundled mock data (demo mode)
            setTreeData(getMockTreeData());
            setLoading(false);
        };
        fetchTree();
    }, []);

    // Filtered data for view mode
    const displayData = useMemo(() => {
        if (!treeData) return null;
        if (viewMode === 'full' || !focusPerson) return treeData;
        if (viewMode === 'ancestor') return filterAncestors(focusPerson, treeData.people, treeData.families);
        if (viewMode === 'descendant') return filterDescendants(focusPerson, treeData.people, treeData.families);
        return treeData;
    }, [treeData, viewMode, focusPerson]);

    // F1: Zoom level
    const zoomLevel = useMemo<ZoomLevel>(() => exporting ? 'full' : getZoomLevel(transform.scale), [transform.scale, exporting]);

    // F4: Get all descendants of collapsed branches
    const getDescendantIds = useCallback((handle: string): Set<string> => {
        if (!treeData) return new Set();
        const familyMap = new Map(treeData.families.map(f => [f.id, f]));
        const parentFamiliesMap = buildParentToFamiliesMap(treeData.families);
        const result = new Set<string>();
        function walk(h: string) {
            for (const fId of (parentFamiliesMap.get(h) || [])) {
                const fam = familyMap.get(fId);
                if (!fam) continue;
                // Include spouse
                if (fam.motherId && fam.motherId !== h) result.add(fam.motherId);
                if (fam.fatherId && fam.fatherId !== h) result.add(fam.fatherId);
                for (const ch of fam.childIds) {
                    result.add(ch);
                    walk(ch);
                }
            }
        }
        walk(handle);
        return result;
    }, [treeData]);

    // F4: Compute all hidden handles from collapsed branches
    const hiddenIds = useMemo(() => {
        if (!treeData) return new Set<string>();
        const hidden = new Set<string>();
        for (const h of collapsedBranches) {
            const descendants = getDescendantIds(h);
            for (const d of descendants) hidden.add(d);
        }
        // Collapsed persons must stay visible to show their summary card.
        // (getDescendantIds includes spouses, so when both parents are collapsed,
        // each marks the other as a "descendant" → both get hidden. Fix: un-hide them.)
        for (const h of collapsedBranches) {
            hidden.delete(h);
        }
        // Cascade: hide people whose ALL parent families have hidden fathers
        // This catches nodes that leaked through (e.g., gen 13 whose gen 12 parents are hidden)
        const familyMap = new Map(treeData.families.map(f => [f.id, f]));
        let changed = true;
        while (changed) {
            changed = false;
            for (const p of treeData.people) {
                if (hidden.has(p.id)) continue;
                if (collapsedBranches.has(p.id)) continue; // collapsed persons stay visible
                if (p.parentFamilyIds.length === 0) continue;
                // Check if ALL parent families have their father/mother hidden
                const allParentsHidden = p.parentFamilyIds.every(pfId => {
                    const pf = familyMap.get(pfId);
                    if (!pf) return true; // orphan family = treat as hidden
                    const fatherHidden = pf.fatherId ? hidden.has(pf.fatherId) : true;
                    const motherHidden = pf.motherId ? hidden.has(pf.motherId) : true;
                    return fatherHidden && motherHidden;
                });
                if (allParentsHidden) {
                    hidden.add(p.id);
                    changed = true;
                }
            }
        }
        return hidden;
    }, [collapsedBranches, getDescendantIds, treeData]);

    // F4: Branch summaries for collapsed branches
    const branchSummaries = useMemo(() => {
        if (!treeData) return new Map<string, BranchSummary>();
        const map = new Map<string, BranchSummary>();
        for (const h of collapsedBranches) {
            map.set(h, computeBranchSummary(h, treeData.people, treeData.families));
        }
        return map;
    }, [collapsedBranches, treeData]);

    // F4: Toggle collapse — reveals one level at a time when expanding
    const toggleCollapse = useCallback((handle: string) => {
        if (!treeData) return;
        const parentFamiliesMap = buildParentToFamiliesMap(treeData.families);
        const familyMap = new Map(treeData.families.map(f => [f.id, f]));
        setCollapsedBranches(prev => {
            const next = new Set(prev);
            if (next.has(handle)) {
                // Expanding: remove this person's collapse, but auto-collapse their
                // direct children who have descendants (progressive reveal)
                next.delete(handle);
                for (const fId of (parentFamiliesMap.get(handle) || [])) {
                    const fam = familyMap.get(fId);
                    if (!fam) continue;
                    for (const ch of fam.childIds) {
                        // Check if child has their own children (using families table)
                        const childHasChildren = (parentFamiliesMap.get(ch) || []).some(cfId => {
                            const cf = familyMap.get(cfId);
                            return cf && cf.childIds.length > 0;
                        });
                        if (childHasChildren) {
                            next.add(ch);
                        }
                    }
                }
            } else {
                next.add(handle);
            }
            return next;
        });
    }, [treeData]);

    // Expand All / Collapse All
    const expandAll = useCallback(() => {
        setCollapsedBranches(new Set());
    }, []);

    const collapseAll = useCallback(() => {
        if (!treeData) return;
        const allParents = new Set<string>();
        for (const f of treeData.families) {
            if (f.childIds.length > 0) {
                if (f.fatherId) allParents.add(f.fatherId);
                if (f.motherId) allParents.add(f.motherId);
            }
        }
        setCollapsedBranches(allParents);
    }, [treeData]);

    // Auto-collapse for Toàn cảnh view
    const autoCollapseForPanoramic = useCallback(() => {
        if (!treeData) return;
        const gens = computePersonGenerations(treeData.people, treeData.families);
        const toCollapse = new Set<string>();
        for (const f of treeData.families) {
            if (f.childIds.length === 0) continue;
            const parentId = f.fatherId || f.motherId;
            if (!parentId) continue;
            const gen = gens.get(parentId);
            if (gen !== undefined && gen >= AUTO_COLLAPSE_GEN) {
                toCollapse.add(parentId);
            }
        }
        setCollapsedBranches(toCollapse);
    }, [treeData]);

    // Auto-collapse for Hậu duệ view: collapse branches beyond AUTO_COLLAPSE_GEN relative depth from focus
    const autoCollapseForDescendant = useCallback((person: string) => {
        if (!treeData) return;
        const parentFamiliesMap = buildParentToFamiliesMap(treeData.families);
        const familyMap = new Map(treeData.families.map(f => [f.id, f]));
        const toCollapse = new Set<string>();
        // BFS from person to compute relative depth
        const depthMap = new Map<string, number>();
        const queue: string[] = [person];
        depthMap.set(person, 0);
        while (queue.length > 0) {
            const h = queue.shift()!;
            const depth = depthMap.get(h)!;
            for (const fId of (parentFamiliesMap.get(h) || [])) {
                const fam = familyMap.get(fId);
                if (!fam || fam.childIds.length === 0) continue;
                if (depth >= AUTO_COLLAPSE_GEN) {
                    toCollapse.add(h);
                } else {
                    for (const ch of fam.childIds) {
                        if (!depthMap.has(ch)) {
                            depthMap.set(ch, depth + 1);
                            queue.push(ch);
                        }
                    }
                }
            }
        }
        setCollapsedBranches(toCollapse);
    }, [treeData]);

    // Compute layout — filter out hidden nodes from collapsed branches
    const layout = useMemo<LayoutResult | null>(() => {
        if (!displayData) return null;
        const d = 'filteredPeople' in displayData
            ? { people: (displayData as any).filteredPeople, families: (displayData as any).filteredFamilies }
            : displayData;
        // F4: Filter out hidden handles
        const visiblePeople = d.people.filter((p: TreeNode) => !hiddenIds.has(p.id));
        const visibleFamilies = d.families.filter((f: TreeFamily) => {
            // Keep family only if NOT all parents are hidden
            const fatherHidden = f.fatherId ? hiddenIds.has(f.fatherId) : true;
            const motherHidden = f.motherId ? hiddenIds.has(f.motherId) : true;
            return !(fatherHidden && motherHidden);
        });
        return computeLayout(visiblePeople, visibleFamilies);
    }, [displayData, hiddenIds]);

    // F4: Check if a person has children (for showing toggle button)
    const hasChildren = useCallback((handle: string): boolean => {
        if (!treeData) return false;
        return treeData.families.some(f =>
            (f.fatherId === handle || f.motherId === handle) && f.childIds.length > 0
        );
    }, [treeData]);

    // F3: Stats computed from full layout
    const treeStats = useMemo<TreeStats | null>(() => {
        if (!layout || !treeData) return null;
        return computeTreeStats(layout.nodes, treeData.families);
    }, [layout, treeData]);

    // F2: Generation stats for headers — use actual Đời from person data
    const generationStats = useMemo(() => {
        if (!layout) return new Map<number, { count: number; y: number }>();
        const map = new Map<number, { count: number; y: number }>();
        for (const n of layout.nodes) {
            const gen = n.node.generation; // actual Đời number from data
            const existing = map.get(gen);
            if (existing) {
                existing.count++;
            } else {
                map.set(gen, { count: 1, y: n.y });
            }
        }
        return map;
    }, [layout]);

    // ═══ Viewport culling: only render visible nodes ═══
    const CULL_PAD = 300; // px padding around viewport

    const visibleNodes = useMemo(() => {
        if (!layout) return [];
        // When exporting, render ALL nodes (no culling)
        if (exporting) return layout.nodes;
        if (!viewportRef.current) return layout.nodes;
        const vw = viewportRef.current.clientWidth;
        const vh = viewportRef.current.clientHeight;
        const { x: tx, y: ty, scale } = transform;
        // Convert viewport rect to tree-space coordinates
        const left = (-tx / scale) - CULL_PAD;
        const top = (-ty / scale) - CULL_PAD;
        const right = ((vw - tx) / scale) + CULL_PAD;
        const bottom = ((vh - ty) / scale) + CULL_PAD;
        return layout.nodes.filter(n =>
            n.x + CARD_W >= left && n.x <= right &&
            n.y + CARD_H >= top && n.y <= bottom
        );
    }, [layout, transform, exporting]);

    const visibleIds = useMemo(() => new Set(visibleNodes.map(n => n.node.id)), [visibleNodes]);

    // Batched SVG paths for connections
    const { parentPaths, couplePaths, visibleCouples } = useMemo(() => {
        if (!layout) return { parentPaths: '', couplePaths: '', visibleCouples: [] as PositionedCouple[] };
        let pp = '';
        let cp = '';
        const vc: PositionedCouple[] = [];

        const shouldCull = !exporting;
        const vw = viewportRef.current?.clientWidth ?? 1200;
        const vh = viewportRef.current?.clientHeight ?? 900;
        const { x: tx, y: ty, scale } = transform;
        const left = (-tx / scale) - CULL_PAD;
        const top = (-ty / scale) - CULL_PAD;
        const right = ((vw - tx) / scale) + CULL_PAD;
        const bottom = ((vh - ty) / scale) + CULL_PAD;

        for (const c of layout.connections) {
            if (shouldCull) {
                const minX = Math.min(c.fromX, c.toX);
                const maxX = Math.max(c.fromX, c.toX);
                const minY = Math.min(c.fromY, c.toY);
                const maxY = Math.max(c.fromY, c.toY);
                if (maxX < left || minX > right || maxY < top || minY > bottom) continue;
            }
            if (c.type === 'couple') {
                cp += `M${c.fromX},${c.fromY}L${c.toX},${c.toY}`;
            } else {
                pp += `M${c.fromX},${c.fromY}L${c.toX},${c.toY}`;
            }
        }
        // Visible couples for hearts
        for (const c of layout.couples) {
            if (!shouldCull || visibleIds.has(c.fatherPos?.node.id ?? '') || visibleIds.has(c.motherPos?.node.id ?? '')) {
                vc.push(c);
            }
        }
        return { parentPaths: pp, couplePaths: cp, visibleCouples: vc };
    }, [layout, transform, visibleIds, exporting]);

    // Stable callbacks for PersonCard
    const handleCardHover = useCallback((h: string | null) => setHoveredId(h), []);
    const handleCardClick = useCallback((handle: string, x: number, y: number) => {
        if (editorMode) {
            setSelectedCard(handle);
            return;
        }
        // Kinship mode: tick/untick select (max 2)
        if (kinshipMode) {
            setKinshipSelected(prev => {
                if (prev.includes(handle)) {
                    // Untick
                    return prev.filter(h => h !== handle);
                }
                if (prev.length >= 2) {
                    // Replace the second selection
                    return [prev[0], handle];
                }
                return [...prev, handle];
            });
            return;
        }
        setContextMenu({ id: handle, x, y });
    }, [editorMode, kinshipMode]);
    const handleCardFocus = useCallback((handle: string) => {
        setFocusPerson(handle);
    }, []);

    // === Handle generators (shared between EditorPanel and QuickAddDialog) ===
    // Handle format: Dxx-yyy (patrilineal child), S_Dxx-yyy (spouse)
    const nextChildId = useCallback((generation: number) => {
        if (!treeData) return `D${String(generation).padStart(2, '0')}-001`;
        const genStr = String(generation).padStart(2, '0');
        const prefix = `D${genStr}-`;
        const maxIdx = treeData.people
            .filter(p => p.id.startsWith(prefix))
            .reduce((max, p) => {
                const idx = parseInt(p.id.replace(prefix, '')) || 0;
                return Math.max(max, idx);
            }, 0);
        return `${prefix}${String(maxIdx + 1).padStart(3, '0')}`;
    }, [treeData]);

    const nextSpouseId = useCallback((contextPersonHandle: string) => {
        // Strip any existing S_ prefix to get the patrilineal base handle
        const baseHandle = contextPersonHandle.replace(/^S_/, '');
        const candidate = `S_${baseHandle}`;
        if (!treeData) return candidate;
        // Check if this handle already exists
        if (!treeData.people.some(p => p.id === candidate)) {
            return candidate;
        }
        // Handle already exists → append suffix _2, _3, etc.
        let suffix = 2;
        while (treeData.people.some(p => p.id === `${candidate}_${suffix}`)) {
            suffix++;
        }
        return `${candidate}_${suffix}`;
    }, [treeData]);

    // Legacy nextId for EditorPanel compatibility (generates Dxx-yyy for given gen)
    const nextId = useCallback((generation?: number) => {
        const gen = generation ?? 1;
        return nextChildId(gen);
    }, [nextChildId]);

    const nextFamilyId = useCallback(() => {
        if (!treeData) return 'F001';
        const maxNum = treeData.families.reduce((max, f) => {
            const num = parseInt(f.id.replace(/\D/g, '')) || 0;
            return Math.max(max, num);
        }, 0);
        return `F${String(maxNum + 1).padStart(3, '0')}`;
    }, [treeData]);

    // === Quick add person handler (from context menu) ===
    const handleQuickAddPerson = useCallback(async (newPerson: {
        id: string; displayName: string; gender: number; generation: number;
        birthYear?: number; parentFamilyId?: string;
        // Extended fields
        nickName?: string; birthDate?: string; phone?: string;
        currentAddress?: string; education?: string; occupation?: string;
        notes?: string; title?: string; birthOrder?: number;
        maritalStatus?: string; bloodType?: string; isLiving?: boolean;
    }, contextPerson: TreeNode) => {
        if (!treeData) return;
        const treeNode: TreeNode = {
            id: newPerson.id,
            displayName: newPerson.displayName,
            gender: newPerson.gender,
            generation: newPerson.generation,
            birthYear: newPerson.birthYear,
            isLiving: newPerson.isLiving ?? true,
            isPrivacyFiltered: false,
            // Children inherit patrilineal from lineage (not gender);
            // spouses are always non-patrilineal (overridden below)
            isPatrilineal: newPerson.generation !== contextPerson.generation
                ? (contextPerson.isPatrilineal || !contextPerson.id.startsWith('S_'))
                : false,
            familyIds: [],
            parentFamilyIds: newPerson.parentFamilyId ? [newPerson.parentFamilyId] : [],
        };

        setTreeData(prev => {
            if (!prev) return null;
            let newPeople = [...prev.people, treeNode];
            let newFamilies = [...prev.families];

            if (newPerson.parentFamilyId) {
                const existingFamily = newFamilies.find(f => f.id === newPerson.parentFamilyId);
                if (existingFamily) {
                    if (newPerson.generation === contextPerson.generation) {
                        // Adding spouse
                        if (newPerson.gender === 2 && !existingFamily.motherId) {
                            newFamilies = newFamilies.map(f => f.id === newPerson.parentFamilyId ? { ...f, motherId: newPerson.id } : f);
                            treeNode.familyIds = [newPerson.parentFamilyId!];
                            treeNode.parentFamilyIds = [];
                            treeNode.isPatrilineal = false;
                        } else if (newPerson.gender === 1 && !existingFamily.fatherId) {
                            newFamilies = newFamilies.map(f => f.id === newPerson.parentFamilyId ? { ...f, fatherId: newPerson.id } : f);
                            treeNode.familyIds = [newPerson.parentFamilyId!];
                            treeNode.parentFamilyIds = [];
                            treeNode.isPatrilineal = false;
                        }
                    } else {
                        // Adding child
                        newFamilies = newFamilies.map(f =>
                            f.id === newPerson.parentFamilyId
                                ? { ...f, childIds: [...f.childIds, newPerson.id] }
                                : f
                        );
                    }
                } else {
                    // Create new family
                    if (newPerson.generation === contextPerson.generation) {
                        // Spouse — new family
                        const newFamily: TreeFamily = {
                            id: newPerson.parentFamilyId,
                            fatherId: contextPerson.gender === 1 ? contextPerson.id : newPerson.id,
                            motherId: contextPerson.gender === 2 ? contextPerson.id : newPerson.id,
                            childIds: [],
                        };
                        newFamilies.push(newFamily);
                        // Immutable update: create new object for contextPerson
                        newPeople = newPeople.map(p =>
                            p.id === contextPerson.id
                                ? { ...p, familyIds: [...(p.familyIds || []), newPerson.parentFamilyId!] }
                                : p
                        );
                        treeNode.familyIds = [newPerson.parentFamilyId!];
                        treeNode.parentFamilyIds = [];
                        treeNode.isPatrilineal = false;
                    } else {
                        // Child — new family
                        const newFamily: TreeFamily = {
                            id: newPerson.parentFamilyId,
                            fatherId: contextPerson.gender === 1 ? contextPerson.id : undefined,
                            motherId: contextPerson.gender === 2 ? contextPerson.id : undefined,
                            childIds: [newPerson.id],
                        };
                        newFamilies.push(newFamily);
                        // Immutable update: create new object for contextPerson
                        newPeople = newPeople.map(p =>
                            p.id === contextPerson.id
                                ? { ...p, familyIds: [...(p.familyIds || []), newPerson.parentFamilyId!] }
                                : p
                        );
                    }
                }
            }

            return { people: newPeople, families: newFamilies };
        });

        // Persist to Supabase (with all extended fields)
        await supaAddPerson({
            id: treeNode.id,
            displayName: treeNode.displayName,
            gender: treeNode.gender,
            generation: treeNode.generation,
            birthYear: treeNode.birthYear,
            isLiving: newPerson.isLiving ?? true,
            isPatrilineal: treeNode.isPatrilineal,
            familyIds: treeNode.familyIds,
            parentFamilyIds: treeNode.parentFamilyIds,
            nickName: newPerson.nickName || null,
            birthDate: newPerson.birthDate || null,
            phone: newPerson.phone || null,
            currentAddress: newPerson.currentAddress || null,
            education: newPerson.education || null,
            occupation: newPerson.occupation || null,
            notes: newPerson.notes || null,
            title: newPerson.title || null,
            birthOrder: newPerson.birthOrder ?? null,
            maritalStatus: newPerson.maritalStatus || null,
            bloodType: newPerson.bloodType || null,
        });

        // Persist new family if created
        if (newPerson.parentFamilyId) {
            const existingFamily = treeData.families.find(f => f.id === newPerson.parentFamilyId);
            if (!existingFamily) {
                if (newPerson.generation === contextPerson.generation) {
                    await supaAddFamily({
                        id: newPerson.parentFamilyId,
                        fatherId: contextPerson.gender === 1 ? contextPerson.id : newPerson.id,
                        motherId: contextPerson.gender === 2 ? contextPerson.id : newPerson.id,
                        childIds: [],
                    });
                } else {
                    await supaAddFamily({
                        id: newPerson.parentFamilyId,
                        fatherId: contextPerson.gender === 1 ? contextPerson.id : undefined,
                        motherId: contextPerson.gender === 2 ? contextPerson.id : undefined,
                        childIds: [newPerson.id],
                    });
                }
                // Persist parent's updated families to Supabase (fixes collapse bug after reload)
                await supaUpdatePersonFamilies(
                    contextPerson.id,
                    [...(contextPerson.familyIds || []), newPerson.parentFamilyId],
                );
            } else {
                if (newPerson.generation !== contextPerson.generation) {
                    await supaUpdateFamilyChildren(newPerson.parentFamilyId, [...existingFamily.childIds, newPerson.id]);
                }
            }
        }
    }, [treeData]);

    // === Drag-and-drop handlers (editor mode) ===
    const handleCardDragStart = useCallback((handle: string, clientX: number, clientY: number) => {
        if (!editorMode) return;
        setDragState({ id: handle, startX: clientX, startY: clientY, currentX: clientX, currentY: clientY });
    }, [editorMode]);

    const handleCardDragMove = useCallback((clientX: number, clientY: number) => {
        if (!dragState) return;
        setDragState(prev => prev ? { ...prev, currentX: clientX, currentY: clientY } : null);
        // Hit-test for drop target
        if (!layout || !viewportRef.current) return;
        const rect = viewportRef.current.getBoundingClientRect();
        const mx = (clientX - rect.left - transform.x) / transform.scale;
        const my = (clientY - rect.top - transform.y) / transform.scale;
        let found: string | null = null;
        for (const n of layout.nodes) {
            if (n.node.id === dragState.id) continue;
            if (mx >= n.x && mx <= n.x + CARD_W && my >= n.y && my <= n.y + CARD_H) {
                found = n.node.id;
                break;
            }
        }
        setDropTarget(found);
    }, [dragState, layout, transform]);

    const handleCardDrop = useCallback(() => {
        if (!dragState || !dropTarget || !treeData) {
            setDragState(null);
            setDropTarget(null);
            return;
        }
        const draggedPerson = treeData.people.find(p => p.id === dragState.id);
        const targetPerson = treeData.people.find(p => p.id === dropTarget);
        if (!draggedPerson || !targetPerson) {
            setDragState(null);
            setDropTarget(null);
            return;
        }

        // Find family where dragged person is a child
        const fromFamily = treeData.families.find(f => f.childIds.includes(dragState.id));
        if (!fromFamily) {
            setDragState(null);
            setDropTarget(null);
            return;
        }

        // Find or create family where target person is a parent
        let toFamily = treeData.families.find(f =>
            f.fatherId === dropTarget || f.motherId === dropTarget
        );

        if (toFamily && toFamily.id !== fromFamily.id) {
            // Move child from one family to another
            setTreeData(prev => {
                if (!prev) return null;
                const families = prev.families.map(f => {
                    if (f.id === fromFamily.id) return { ...f, childIds: f.childIds.filter(c => c !== dragState.id) };
                    if (f.id === toFamily!.id) return { ...f, childIds: [...f.childIds, dragState.id] };
                    return f;
                });
                supaMoveChild(dragState.id, fromFamily.id, toFamily!.id, prev.families);
                return { ...prev, families };
            });
        }

        setDragState(null);
        setDropTarget(null);
    }, [dragState, dropTarget, treeData]);

    // Search highlight
    useEffect(() => {
        if (!searchQuery || !treeData) { setHighlightIds(new Set()); return; }
        const q = searchQuery.toLowerCase();
        setHighlightIds(new Set(treeData.people.filter(p => p.displayName.toLowerCase().includes(q)).map(p => p.id)));
    }, [searchQuery, treeData]);

    // Fit all
    const fitAll = useCallback(() => {
        if (!layout || !viewportRef.current) return;
        const vw = viewportRef.current.clientWidth;
        const vh = viewportRef.current.clientHeight;
        const pad = 40;
        const tw = layout.width + pad * 2;
        const th = layout.height + pad * 2;
        const scale = Math.max(Math.min(vw / tw, vh / th, 1.2), 0.12);
        setTransform({
            x: (vw - layout.width * scale) / 2,
            y: (vh - layout.height * scale) / 2,
            scale,
        });
    }, [layout]);

    // Export tree as PNG image
    const handleExportImage = useCallback(async () => {
        if (!layout || !treeContentRef.current) return;
        setExporting(true);
        // Wait for React to re-render with all nodes at full detail (no culling, zoomLevel='full')
        await new Promise(r => setTimeout(r, 800));
        try {
            const el = treeContentRef.current;
            const dataUrl = await toPng(el, {
                backgroundColor: '#faf9f6',
                style: {
                    transform: 'none',
                    transformOrigin: '0 0',
                },
                pixelRatio: 1,
            });
            const link = document.createElement('a');
            link.download = `pha-do-${new Date().toISOString().slice(0, 10)}.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error('Export failed:', err);
            alert('Xuất ảnh thất bại. Vui lòng thử lại.');
        } finally {
            setExporting(false);
        }
    }, [layout]);

    // Center on root ancestor at readable zoom on first load
    const initialFitDone = useRef(false);
    useEffect(() => {
        if (!layout || loading) return;
        if (initialFitDone.current) return;
        // If URL requested a specific view mode, wait until layout matches that mode
        const urlView = initialViewFromUrl.current;
        if (urlView === 'descendant' && viewMode !== 'descendant') return;
        if (urlView === 'ancestor' && viewMode !== 'ancestor') return;
        initialFitDone.current = true;
        setTimeout(() => {
            if (!viewportRef.current) return;
            const vw = viewportRef.current.clientWidth;
            const vh = viewportRef.current.clientHeight;
            // If a specific person was requested via URL (?focus= or ?person=), center on them
            const urlFocus = initialFocusFromUrl.current;
            const focusNode = urlFocus ? layout.nodes.find(n => n.node.id === urlFocus) : null;
            if (focusNode) {
                // For descendant view: use smart zoom (fitAll if small, center on person if large)
                if (urlView === 'descendant') {
                    const pad = 40;
                    const tw = layout.width + pad * 2;
                    const th = layout.height + pad * 2;
                    const fitScale = Math.min(vw / tw, vh / th, 1.2);
                    const MIN_READABLE_SCALE = 0.45;
                    const scale = Math.max(fitScale, MIN_READABLE_SCALE);
                    if (fitScale >= MIN_READABLE_SCALE) {
                        // Tree fits at readable zoom — center entire tree
                        setTransform({
                            x: (vw - layout.width * scale) / 2,
                            y: (vh - layout.height * scale) / 2,
                            scale,
                        });
                    } else {
                        // Tree too large — center on focus person at readable zoom
                        setTransform({
                            x: vw / 2 - (focusNode.x + CARD_W / 2) * scale,
                            y: vh * 0.3 - (focusNode.y + CARD_H / 2) * scale,
                            scale,
                        });
                    }
                } else {
                    const targetScale = 0.8;
                    setTransform({
                        x: vw / 2 - (focusNode.x + CARD_W / 2) * targetScale,
                        y: vh * 0.3 - focusNode.y * targetScale,
                        scale: targetScale,
                    });
                }
                return;
            }
            // Default: center on cụ Khoan Giản (the branch root) or the earliest patrilineal ancestor
            const khoanGian = layout.nodes.find(n => n.node.id === 'D10-003');
            const rootNode = khoanGian || layout.nodes
                .filter(n => n.node.isPatrilineal)
                .sort((a, b) => a.node.generation - b.node.generation)[0];
            if (rootNode) {
                const targetScale = 0.6;
                setTransform({
                    x: vw / 2 - (rootNode.x + CARD_W / 2) * targetScale,
                    y: vh * 0.15 - rootNode.y * targetScale,
                    scale: targetScale,
                });
            } else {
                fitAll();
            }
        }, 50);
    }, [layout, loading, fitAll, viewMode]);

    // === Mouse handlers ===
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        if (dragState) return; // Don't pan while dragging a card
        setIsDragging(true);
        dragRef.current = { startX: e.clientX, startY: e.clientY, startTx: transform.x, startTy: transform.y };
    };
    const handleMouseMove = (e: React.MouseEvent) => {
        if (dragState) {
            handleCardDragMove(e.clientX, e.clientY);
            return;
        }
        if (!isDragging) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        setTransform(t => ({ ...t, x: dragRef.current.startTx + dx, y: dragRef.current.startTy + dy }));
    };
    const handleMouseUp = () => {
        if (dragState) {
            handleCardDrop();
            return;
        }
        setIsDragging(false);
    };

    // === Scroll-wheel zoom ===
    useEffect(() => {
        const el = viewportRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const rect = el.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            setTransform(t => {
                const newScale = Math.min(Math.max(t.scale * delta, 0.15), 3);
                const ratio = newScale / t.scale;
                return { scale: newScale, x: mx - (mx - t.x) * ratio, y: my - (my - t.y) * ratio };
            });
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, []);

    // === Touch handlers (stable – uses refs to avoid stale closures) ===
    useEffect(() => {
        const el = viewportRef.current;
        if (!el) return;

        const onTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 1) {
                touchingRef.current = true;
                const t = e.touches[0];
                const tr = transformRef.current;
                dragRef.current = { startX: t.clientX, startY: t.clientY, startTx: tr.x, startTy: tr.y };
            } else if (e.touches.length === 2) {
                // Switching from 1-finger pan to 2-finger pinch
                touchingRef.current = false;
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY,
                );
                pinchRef.current = { initialDist: dist, initialScale: transformRef.current.scale };
            }
        };

        const onTouchMove = (e: TouchEvent) => {
            e.preventDefault();
            if (e.touches.length === 1 && touchingRef.current) {
                const t = e.touches[0];
                const dx = t.clientX - dragRef.current.startX;
                const dy = t.clientY - dragRef.current.startY;
                setTransform(prev => ({ ...prev, x: dragRef.current.startTx + dx, y: dragRef.current.startTy + dy }));
            } else if (e.touches.length === 2) {
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY,
                );
                const ratio = dist / pinchRef.current.initialDist;
                const newScale = Math.min(Math.max(pinchRef.current.initialScale * ratio, 0.15), 3);

                const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                const rect = el.getBoundingClientRect();
                const mx = midX - rect.left;
                const my = midY - rect.top;

                setTransform(prev => {
                    const r = newScale / prev.scale;
                    return { scale: newScale, x: mx - (mx - prev.x) * r, y: my - (my - prev.y) * r };
                });
            }
        };

        const onTouchEnd = (e: TouchEvent) => {
            if (e.touches.length === 0) {
                touchingRef.current = false;
            } else if (e.touches.length === 1) {
                // Went from 2 fingers back to 1 — restart single-finger pan
                touchingRef.current = true;
                const t = e.touches[0];
                const tr = transformRef.current;
                dragRef.current = { startX: t.clientX, startY: t.clientY, startTx: tr.x, startTy: tr.y };
            }
        };

        el.addEventListener('touchstart', onTouchStart, { passive: false });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd);
        el.addEventListener('touchcancel', onTouchEnd);
        return () => {
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
            el.removeEventListener('touchcancel', onTouchEnd);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Pan to person
    const panToPerson = useCallback((handle: string) => {
        if (!layout || !viewportRef.current) return;
        const node = layout.nodes.find(n => n.node.id === handle);
        if (!node) return;
        const vw = viewportRef.current.clientWidth;
        const vh = viewportRef.current.clientHeight;
        setTransform(t => ({
            ...t,
            x: vw / 2 - (node.x + CARD_W / 2) * t.scale,
            y: vh / 2 - (node.y + CARD_H / 2) * t.scale,
        }));
        setFocusPerson(handle);
    }, [layout]);

    // Pending fitAll flag — triggers fitAll after layout recalculates from view mode change
    const pendingFitAll = useRef(false);
    // Pending center-on-person — used by descendant mode to center on focus person at readable zoom
    const pendingCenterPerson = useRef<string | null>(null);

    // View mode — targetPerson overrides focusPerson for context-menu / search triggers
    const changeViewMode = (mode: ViewMode, targetPerson?: string) => {
        if (mode === 'full') {
            // Toàn cảnh: show FULL tree overview — expand all, then fit entire tree
            setViewMode('full');
            setCollapsedBranches(new Set()); // expand all branches
            setFocusPerson(null);
            pendingFitAll.current = true;
        } else if (mode === 'ancestor') {
            // Tổ tiên: show patrilineal ancestor chain, collapsed per generation
            // Each generation shows 1 person; expand to reveal next generation
            if (treeData) {
                let person: string | null;
                if (targetPerson) {
                    person = targetPerson;
                } else {
                    const patrilineals = treeData.people.filter(p => p.isPatrilineal);
                    const latestPatrilineal = patrilineals.sort((a, b) => b.generation - a.generation)[0];
                    person = latestPatrilineal?.id || focusPerson || treeData.people[0]?.id || null;
                }
                if (person) {
                    setFocusPerson(person);
                    setViewMode('ancestor');
                    // Auto-collapse: collapse all ancestors so only Đời 1 is visible initially
                    // User expands one generation at a time to explore the lineage
                    const { filteredPeople } = filterAncestors(person, treeData.people, treeData.families);
                    const toCollapse = new Set<string>();
                    for (const p of filteredPeople) {
                        // Collapse everyone except the focus person (last generation)
                        if (p.id !== person) {
                            toCollapse.add(p.id);
                        }
                    }
                    setCollapsedBranches(toCollapse);
                    pendingFitAll.current = true;
                }
            }
        } else if (mode === 'descendant') {
            const person = targetPerson || focusPerson || treeData?.people[0]?.id;
            if (person) {
                setFocusPerson(person);
                setViewMode('descendant');
                autoCollapseForDescendant(person);
                pendingCenterPerson.current = person;
            }
        }
    };

    // Effect: run fitAll when layout recalculates after a view mode change
    useEffect(() => {
        if (!pendingFitAll.current || !layout) return;
        pendingFitAll.current = false;
        // Small delay to ensure DOM has updated
        setTimeout(() => fitAll(), 50);
    }, [layout, fitAll]);

    // Effect: center on focus person at readable zoom (descendant mode)
    useEffect(() => {
        if (!pendingCenterPerson.current || !layout || !viewportRef.current) return;
        const handle = pendingCenterPerson.current;
        pendingCenterPerson.current = null;
        const node = layout.nodes.find(n => n.node.id === handle);
        if (!node) { setTimeout(() => fitAll(), 50); return; } // fallback
        const vw = viewportRef.current.clientWidth;
        const vh = viewportRef.current.clientHeight;
        // Compute fitAll scale, but clamp to a minimum readable level
        const pad = 40;
        const tw = layout.width + pad * 2;
        const th = layout.height + pad * 2;
        const fitScale = Math.min(vw / tw, vh / th, 1.2);
        const MIN_READABLE_SCALE = 0.45;
        const scale = Math.max(fitScale, MIN_READABLE_SCALE);
        setTimeout(() => {
            if (fitScale >= MIN_READABLE_SCALE) {
                // Tree fits at readable zoom — center entire tree
                setTransform({
                    x: (vw - layout.width * scale) / 2,
                    y: (vh - layout.height * scale) / 2,
                    scale,
                });
            } else {
                // Tree too large — center on focus person at readable zoom
                setTransform({
                    x: vw / 2 - (node.x + CARD_W / 2) * scale,
                    y: vh * 0.3 - (node.y + CARD_H / 2) * scale,
                    scale,
                });
            }
        }, 50);
    }, [layout, fitAll]);

    // Copy shareable link
    const copyTreeLink = useCallback((handle: string) => {
        const url = `${window.location.origin}${pathname}?view=descendant&person=${handle}`;
        navigator.clipboard.writeText(url).then(() => {
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        });
    }, []);

    // Search results
    const searchResults = useMemo(() => {
        if (!searchQuery || !treeData) return [];
        const q = searchQuery.toLowerCase();
        return treeData.people.filter(p => p.displayName.toLowerCase().includes(q)).slice(0, 8);
    }, [searchQuery, treeData]);

    // connPath kept for compatibility but unused with batched rendering

    return (
        <div className="flex flex-col h-[calc(100vh-80px)]">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2 px-1 pb-2">
                <div className="min-w-0">
                    <h1 className="text-lg sm:text-xl font-bold tracking-tight flex items-center gap-2">
                        <TreePine className="h-5 w-5 shrink-0" /> Phả đồ
                    </h1>
                    <p className="text-muted-foreground text-xs truncate">
                        {layout ? `${layout.nodes.length} thành viên` : 'Đang tải...'}
                        {viewMode !== 'full' && focusPerson && (
                            <span className="ml-1 text-blue-500">
                                • {viewMode === 'ancestor' ? 'Tổ tiên' : 'Hậu duệ'} của{' '}
                                {treeData?.people.find(p => p.id === focusPerson)?.displayName}
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                    {/* View modes + Xưng hô */}
                    <div className="flex rounded-lg border overflow-hidden text-xs">
                        {([['full', 'Toàn cảnh', Eye], ['ancestor', 'Tổ tiên', Users], ['descendant', 'Hậu duệ', GitBranch]] as const).map(([mode, label, Icon]) => (
                            <button key={mode} onClick={() => { if (kinshipMode) { setKinshipMode(false); setKinshipSelected([]); setKinshipResult(null); } changeViewMode(mode); }}
                                className={`px-1.5 sm:px-2.5 py-1.5 font-medium flex items-center gap-1 transition-colors ${mode !== 'full' ? 'border-l' : ''} ${!kinshipMode && viewMode === mode ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                                <Icon className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{label}</span>
                            </button>
                        ))}
                        <button onClick={() => {
                            if (kinshipMode) { setKinshipMode(false); setKinshipSelected([]); setKinshipResult(null); }
                            else { setKinshipMode(true); setEditorMode(false); setSelectedCard(null); }
                        }}
                            className={`px-1.5 sm:px-2.5 py-1.5 font-medium flex items-center gap-1 transition-colors border-l ${kinshipMode ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                            <ArrowLeftRight className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Xưng hô</span>
                        </button>
                    </div>
                    {/* Search */}
                    <div className="relative">
                        <div className="relative w-32 sm:w-44">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input placeholder="Tìm kiếm..." value={searchQuery}
                                onChange={e => { setSearchQuery(e.target.value); setShowSearch(true); }}
                                onFocus={() => setShowSearch(true)} className="pl-8 h-8 text-xs" />
                        </div>
                        {showSearch && searchResults.length > 0 && (
                            <Card className="absolute z-50 w-56 right-0 top-10 shadow-lg">
                                <CardContent className="p-1 max-h-52 overflow-y-auto">
                                    {searchResults.map(p => (
                                        <button key={p.id} onClick={() => {
                                            changeViewMode('descendant', p.id);
                                            setShowSearch(false);
                                            setSearchQuery('');
                                        }}
                                            className="w-full text-left px-2.5 py-1.5 rounded text-xs hover:bg-accent transition-colors flex justify-between">
                                            <span className="font-medium">{p.displayName}</span>
                                            <span className="text-muted-foreground">{'generation' in p ? `Đời ${(p as any).generation}` : ''}{p.isPrivacyFiltered ? ' 🔒' : ''}</span>
                                        </button>
                                    ))}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                    {/* Controls */}
                    <div className="flex gap-0.5">
                        <Button variant="outline" size="icon" className="h-8 w-8 hidden sm:inline-flex" title="Thu gọn tất cả" onClick={collapseAll}><ChevronsDownUp className="h-3.5 w-3.5" /></Button>
                        <Button variant="outline" size="icon" className="h-8 w-8 hidden sm:inline-flex" title="Mở rộng tất cả" onClick={expandAll}><ChevronsUpDown className="h-3.5 w-3.5" /></Button>
                        <div className="w-px bg-border mx-0.5 hidden sm:block" />
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setTransform(t => {
                            const vw = viewportRef.current?.clientWidth ?? 0; const vh = viewportRef.current?.clientHeight ?? 0;
                            const cx = vw / 2; const cy = vh / 2;
                            const ns = Math.min(t.scale * 1.3, 3); const r = ns / t.scale;
                            return { scale: ns, x: cx - (cx - t.x) * r, y: cy - (cy - t.y) * r };
                        })}><ZoomIn className="h-3.5 w-3.5" /></Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setTransform(t => {
                            const vw = viewportRef.current?.clientWidth ?? 0; const vh = viewportRef.current?.clientHeight ?? 0;
                            const cx = vw / 2; const cy = vh / 2;
                            const ns = Math.max(t.scale / 1.3, 0.15); const r = ns / t.scale;
                            return { scale: ns, x: cx - (cx - t.x) * r, y: cy - (cy - t.y) * r };
                        })}><ZoomOut className="h-3.5 w-3.5" /></Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={fitAll}><Maximize2 className="h-3.5 w-3.5" /></Button>
                        <Button
                            variant="outline" size="icon"
                            className={`h-8 w-8 ${exporting ? 'animate-pulse bg-amber-100' : ''}`}
                            title="Xuất ảnh Phả đồ"
                            onClick={handleExportImage}
                            disabled={exporting || !layout}
                        >
                            <Camera className="h-3.5 w-3.5" />
                        </Button>
                        {canEdit && (
                            <Button
                                variant={editorMode ? 'default' : 'outline'}
                                size="icon"
                                className={`h-8 w-8 ${editorMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                                title={editorMode ? 'Tắt chỉnh sửa' : 'Chế độ chỉnh sửa'}
                                onClick={() => { setEditorMode(m => !m); setSelectedCard(null); setKinshipMode(false); setKinshipSelected([]); }}
                            >
                                <Pencil className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Tree viewport + Editor panel row */}
            <div className="flex-1 flex gap-0 min-h-0">
                <div ref={viewportRef}
                    className={`flex-1 relative overflow-hidden rounded-xl border-2 bg-gradient-to-br from-background to-muted/30 select-none touch-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                    onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
                    onClick={() => { setShowSearch(false); setContextMenu(null); setQuickAdd(null); if (editorMode) setSelectedCard(null); }}
                >
                    {/* Exporting overlay */}
                    {exporting && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                            <div className="flex flex-col items-center gap-3">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
                                <span className="text-sm font-medium text-amber-700">Đang xuất ảnh Phả đồ...</span>
                            </div>
                        </div>
                    )}
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                        </div>
                    ) : layout && (
                        <div ref={treeContentRef} style={{
                            transform: exporting ? 'none' : `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                            transformOrigin: '0 0', width: layout.width, height: layout.height,
                            position: 'absolute', top: 0, left: 0,
                        }}>
                            {/* SVG connections — batched into 2 paths */}
                            <svg className="absolute inset-0 pointer-events-none" width={layout.width} height={layout.height}
                                style={{ overflow: 'visible' }}>
                                {parentPaths && <path d={parentPaths} stroke="#94a3b8" strokeWidth={1.5} fill="none" />}
                                {couplePaths && <path d={couplePaths} stroke="#cbd5e1" strokeWidth={1.5} fill="none" strokeDasharray="4,3" />}
                                {/* Couple hearts — only visible */}
                                {visibleCouples.map(c => (
                                    <text key={c.familyId}
                                        x={c.midX} y={c.y + CARD_H / 2 + 4}
                                        textAnchor="middle" fontSize="10" fill="#e11d48">❤</text>
                                ))}
                            </svg>

                            {/* DOM nodes — only visible (culled) */}
                            {visibleNodes.map(item => (
                                <MemoPersonCard key={item.node.id} item={item}
                                    isHighlighted={highlightIds.has(item.node.id)}
                                    isFocused={focusPerson === item.node.id}
                                    isHovered={hoveredId === item.node.id}
                                    isSelected={editorMode && selectedCard === item.node.id}
                                    isKinshipA={kinshipSelected.includes(item.node.id)}
                                    isKinshipPath={kinshipResult ? kinshipResult.path.some(s => s.personId === item.node.id) : false}
                                    zoomLevel={zoomLevel}
                                    showCollapseToggle={hasChildren(item.node.id)}
                                    isCollapsed={collapsedBranches.has(item.node.id)}
                                    isDragging={dragState?.id === item.node.id}
                                    isDropTarget={dropTarget === item.node.id}
                                    editorMode={editorMode}
                                    kinshipMode={kinshipMode}
                                    onHover={handleCardHover}
                                    onClick={handleCardClick}
                                    onSetFocus={handleCardFocus}
                                    onToggleCollapse={toggleCollapse}
                                    onDragStart={handleCardDragStart}
                                />
                            ))}

                            {/* F4: Branch summary cards for collapsed nodes */}
                            {Array.from(branchSummaries.entries()).map(([handle, summary]) => {
                                const parentNode = layout.nodes.find(n => n.node.id === handle);
                                if (!parentNode) return null;
                                return (
                                    <BranchSummaryCard
                                        key={`summary-${handle}`}
                                        summary={summary}
                                        parentNode={parentNode}
                                        zoomLevel={zoomLevel}
                                        onExpand={() => toggleCollapse(handle)}
                                    />
                                );
                            })}

                            {/* Drag ghost card */}
                            {dragState && (() => {
                                const draggedNode = layout?.nodes.find(n => n.node.id === dragState.id);
                                if (!draggedNode || !viewportRef.current) return null;
                                const rect = viewportRef.current.getBoundingClientRect();
                                const ghostX = (dragState.currentX - rect.left - transform.x) / transform.scale;
                                const ghostY = (dragState.currentY - rect.top - transform.y) / transform.scale;
                                return (
                                    <div
                                        className="absolute rounded-lg border-2 border-blue-400 bg-blue-50/80 shadow-lg pointer-events-none z-40"
                                        style={{ left: ghostX - CARD_W / 2, top: ghostY - CARD_H / 2, width: CARD_W, height: CARD_H, opacity: 0.8 }}
                                    >
                                        <div className="px-2 py-1.5 h-full flex items-center gap-2">
                                            <GripHorizontal className="w-4 h-4 text-blue-400" />
                                            <p className="text-xs font-semibold text-blue-700 truncate">{draggedNode.node.displayName}</p>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Context menu on card — outside transformed container so fixed positioning works */}
                    {contextMenu && !quickAdd && (() => {
                        const person = treeData?.people.find(p => p.id === contextMenu.id);
                        if (!person) return null;
                        return (
                            <CardContextMenu
                                person={person}
                                x={contextMenu.x}
                                y={contextMenu.y}
                                canEdit={canEdit}
                                isLoggedIn={isLoggedIn}
                                viewportRef={viewportRef}
                                transform={transform}
                                onViewDetail={() => { setDetailPerson(person.id); setContextMenu(null); }}
                                onShowDescendants={() => { changeViewMode('descendant', person.id); setContextMenu(null); }}
                                onShowAncestors={() => { changeViewMode('ancestor', person.id); setContextMenu(null); }}
                                onSetFocus={() => { panToPerson(person.id); setContextMenu(null); }}
                                onShowFull={() => { setViewMode('full'); setContextMenu(null); }}
                                onCopyLink={() => { copyTreeLink(person.id); setContextMenu(null); }}
                                onContribute={() => { setContributePerson({ id: person.id, name: person.displayName }); setContextMenu(null); }}
                                onAddPerson={() => { setQuickAdd({ person, x: contextMenu.x, y: contextMenu.y }); setContextMenu(null); }}
                                onKinship={() => { setKinshipMode(true); setKinshipSelected([person.id]); setContextMenu(null); }}
                                onClose={() => setContextMenu(null)}
                            />
                        );
                    })()}

                    {/* Quick add person dialog — outside transformed container */}
                    {quickAdd && (
                        <QuickAddPersonDialog
                            person={quickAdd.person}
                            x={quickAdd.x}
                            y={quickAdd.y}
                            viewportRef={viewportRef}
                            transform={transform}
                            onSubmit={(data) => {
                                handleQuickAddPerson(data, quickAdd.person);
                                setQuickAdd(null);
                            }}
                            onClose={() => setQuickAdd(null)}
                            nextChildId={nextChildId}
                            nextSpouseId={nextSpouseId}
                            nextFamilyId={nextFamilyId}
                            treeData={treeData}
                        />
                    )}

                    {/* F2: Generation Row Headers */}
                    {layout && (
                        <GenerationHeaders
                            generationStats={generationStats}
                            transform={transform}
                            cardH={CARD_H}
                        />
                    )}

                    {/* F3: Stats Overlay Panel */}
                    {treeStats && zoomLevel === 'mini' && !statsHidden && (
                        <StatsOverlay stats={treeStats} onClose={() => setStatsHidden(true)} />
                    )}

                    {/* Zoom + culling indicator */}
                    <div className="absolute bottom-2 left-2 bg-background/80 backdrop-blur border rounded px-1.5 py-0.5 text-[10px] text-muted-foreground flex gap-1.5">
                        <span>{Math.round(transform.scale * 100)}%</span>
                        {layout && <span className="opacity-60">·</span>}
                        {layout && <span>{visibleNodes.length}/{layout.nodes.length} nodes</span>}
                    </div>

                    {/* Focus person selector */}
                    {viewMode !== 'full' && treeData && (
                        <div className="absolute bottom-2 right-2 bg-background/90 backdrop-blur border rounded-lg px-2 py-1.5 flex items-center gap-1.5 text-xs">
                            <span className="text-muted-foreground">Gốc:</span>
                            <select value={focusPerson || ''} onChange={e => setFocusPerson(e.target.value)}
                                className="border rounded px-1.5 py-0.5 text-xs bg-background max-w-[140px]">
                                {treeData.people.map(p => (
                                    <option key={p.id} value={p.id}>{p.displayName}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Link copied toast */}
                    {linkCopied && (
                        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 z-50">
                            <Copy className="w-3.5 h-3.5" /> Đã sao chép link!
                        </div>
                    )}
                </div>

                {/* Editor Sidebar Panel */}
                {editorMode && (
                    <EditorPanel
                        selectedCard={selectedCard}
                        treeData={treeData}
                        onReorderChildren={(familyId, newOrder) => {
                            setTreeData(prev => prev ? {
                                ...prev,
                                families: prev.families.map(f => f.id === familyId ? { ...f, childIds: newOrder } : f)
                            } : null);
                            supaUpdateFamilyChildren(familyId, newOrder);
                        }}
                        onMoveChild={(childId, fromFamily, toFamily) => {
                            setTreeData(prev => {
                                if (!prev) return null;
                                const families = prev.families.map(f => {
                                    if (f.id === fromFamily) return { ...f, childIds: f.childIds.filter(c => c !== childId) };
                                    if (f.id === toFamily) return { ...f, childIds: [...f.childIds, childId] };
                                    return f;
                                });
                                supaMoveChild(childId, fromFamily, toFamily, prev.families);
                                return { ...prev, families };
                            });
                        }}
                        onRemoveChild={(childId, familyId) => {
                            setTreeData(prev => {
                                if (!prev) return null;
                                const families = prev.families.map(f =>
                                    f.id === familyId ? { ...f, childIds: f.childIds.filter(c => c !== childId) } : f
                                );
                                supaRemoveChild(childId, familyId, prev.families);
                                return { ...prev, families };
                            });
                        }}
                        onToggleLiving={(handle, isLiving) => {
                            setTreeData(prev => prev ? {
                                ...prev,
                                people: prev.people.map(p => p.id === handle ? { ...p, isLiving } : p)
                            } : null);
                            supaUpdatePersonLiving(handle, isLiving);
                        }}
                        onUpdatePerson={(handle, fields) => {
                            setTreeData(prev => {
                                if (!prev) return null;
                                return {
                                    ...prev,
                                    people: prev.people.map(p => p.id === handle ? { ...p, ...fields } : p)
                                };
                            });
                            supaUpdatePerson(handle, fields);
                        }}
                        onAddPerson={async (newPerson) => {
                            // Add person to local state + Supabase
                            const treeNode: TreeNode = {
                                id: newPerson.id,
                                displayName: newPerson.displayName,
                                gender: newPerson.gender,
                                generation: newPerson.generation,
                                birthYear: newPerson.birthYear,
                                isLiving: true,
                                isPrivacyFiltered: false,
                                isPatrilineal: newPerson.gender === 1,
                                familyIds: [],
                                parentFamilyIds: newPerson.parentFamilyId ? [newPerson.parentFamilyId] : [],
                            };

                            setTreeData(prev => {
                                if (!prev) return null;
                                let newPeople = [...prev.people, treeNode];
                                let newFamilies = [...prev.families];

                                if (newPerson.parentFamilyId) {
                                    const existingFamily = newFamilies.find(f => f.id === newPerson.parentFamilyId);
                                    if (existingFamily) {
                                        // Check if this is a spouse addition (same generation as parent)
                                        const parentInFamily = prev.people.find(p =>
                                            p.id === existingFamily.fatherId || p.id === existingFamily.motherId
                                        );
                                        if (parentInFamily && newPerson.generation === (parentInFamily as any).generation) {
                                            // Adding spouse
                                            if (newPerson.gender === 2 && !existingFamily.motherId) {
                                                newFamilies = newFamilies.map(f => f.id === newPerson.parentFamilyId ? { ...f, motherId: newPerson.id } : f);
                                                treeNode.familyIds = [newPerson.parentFamilyId];
                                                treeNode.parentFamilyIds = [];
                                                treeNode.isPatrilineal = false;
                                            } else if (newPerson.gender === 1 && !existingFamily.fatherId) {
                                                newFamilies = newFamilies.map(f => f.id === newPerson.parentFamilyId ? { ...f, fatherId: newPerson.id } : f);
                                                treeNode.familyIds = [newPerson.parentFamilyId];
                                                treeNode.parentFamilyIds = [];
                                                treeNode.isPatrilineal = false;
                                            }
                                        } else {
                                            // Adding child
                                            newFamilies = newFamilies.map(f =>
                                                f.id === newPerson.parentFamilyId
                                                    ? { ...f, childIds: [...f.childIds, newPerson.id] }
                                                    : f
                                            );
                                        }
                                    } else {
                                        // Create new family with selected person as parent
                                        const selectedPerson = prev.people.find(p => p.id === selectedCard);
                                        if (selectedPerson) {
                                            if (newPerson.generation === selectedPerson.generation) {
                                                // Spouse - new family
                                                const newFamily: TreeFamily = {
                                                    id: newPerson.parentFamilyId,
                                                    fatherId: selectedPerson.gender === 1 ? selectedPerson.id : newPerson.id,
                                                    motherId: selectedPerson.gender === 2 ? selectedPerson.id : newPerson.id,
                                                    childIds: [],
                                                };
                                                newFamilies.push(newFamily);
                                                // Immutable update: create new object for selectedPerson
                                                newPeople = newPeople.map(p =>
                                                    p.id === selectedPerson.id
                                                        ? { ...p, familyIds: [...(p.familyIds || []), newPerson.parentFamilyId!] }
                                                        : p
                                                );
                                                treeNode.familyIds = [newPerson.parentFamilyId];
                                                treeNode.parentFamilyIds = [];
                                                treeNode.isPatrilineal = false;
                                            } else {
                                                // Child - new family
                                                const newFamily: TreeFamily = {
                                                    id: newPerson.parentFamilyId,
                                                    fatherId: selectedPerson.gender === 1 ? selectedPerson.id : undefined,
                                                    motherId: selectedPerson.gender === 2 ? selectedPerson.id : undefined,
                                                    childIds: [newPerson.id],
                                                };
                                                newFamilies.push(newFamily);
                                                // Immutable update: create new object for selectedPerson
                                                newPeople = newPeople.map(p =>
                                                    p.id === selectedPerson.id
                                                        ? { ...p, familyIds: [...(p.familyIds || []), newPerson.parentFamilyId!] }
                                                        : p
                                                );
                                            }
                                        }
                                    }
                                }

                                return { people: newPeople, families: newFamilies };
                            });

                            // Persist to Supabase
                            await supaAddPerson({
                                id: treeNode.id,
                                displayName: treeNode.displayName,
                                gender: treeNode.gender,
                                generation: treeNode.generation,
                                birthYear: treeNode.birthYear,
                                isLiving: true,
                                familyIds: treeNode.familyIds,
                                parentFamilyIds: treeNode.parentFamilyIds,
                            });

                            // If we created a new family, persist it too
                            if (newPerson.parentFamilyId) {
                                const existingFamily = treeData?.families.find(f => f.id === newPerson.parentFamilyId);
                                if (!existingFamily) {
                                    // New family was created - persist it
                                    const selectedPerson = treeData?.people.find(p => p.id === selectedCard);
                                    if (selectedPerson) {
                                        if (newPerson.generation === selectedPerson.generation) {
                                            await supaAddFamily({
                                                id: newPerson.parentFamilyId,
                                                fatherId: selectedPerson.gender === 1 ? selectedPerson.id : newPerson.id,
                                                motherId: selectedPerson.gender === 2 ? selectedPerson.id : newPerson.id,
                                                childIds: [],
                                            });
                                        } else {
                                            await supaAddFamily({
                                                id: newPerson.parentFamilyId,
                                                fatherId: selectedPerson.gender === 1 ? selectedPerson.id : undefined,
                                                motherId: selectedPerson.gender === 2 ? selectedPerson.id : undefined,
                                                childIds: [newPerson.id],
                                            });
                                        }
                                        // Persist parent's updated families to Supabase (fixes collapse bug after reload)
                                        await supaUpdatePersonFamilies(
                                            selectedPerson.id,
                                            [...(selectedPerson.familyIds || []), newPerson.parentFamilyId],
                                        );
                                    }
                                } else {
                                    // Existing family - update children or spouse
                                    const parentInFamily = treeData?.people.find(p =>
                                        p.id === existingFamily.fatherId || p.id === existingFamily.motherId
                                    );
                                    if (parentInFamily && newPerson.generation === (parentInFamily as any).generation) {
                                        // Spouse update handled by supabase
                                    } else {
                                        await supaUpdateFamilyChildren(newPerson.parentFamilyId, [...existingFamily.childIds, newPerson.id]);
                                    }
                                }
                            }
                        }}
                        onDeletePerson={async (handle) => {
                            setTreeData(prev => {
                                if (!prev) return null;
                                return {
                                    people: prev.people.filter(p => p.id !== handle),
                                    families: prev.families.map(f => ({
                                        ...f,
                                        childIds: f.childIds.filter(c => c !== handle),
                                        fatherId: f.fatherId === handle ? undefined : f.fatherId,
                                        motherId: f.motherId === handle ? undefined : f.motherId,
                                    })).filter(f => f.fatherId || f.motherId || f.childIds.length > 0),
                                };
                            });
                            setSelectedCard(null);
                            await supaDeletePerson(handle);
                        }}
                        onReset={async () => {
                            const data = await fetchTreeData();
                            setTreeData(data);
                        }}
                        onClose={() => { setEditorMode(false); setSelectedCard(null); }}
                    />
                )}
            </div>

            {/* Legend */}
            <div className="flex gap-3 text-[10px] text-muted-foreground pt-1.5 px-1 flex-wrap">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-100 border border-blue-400" /> Nam</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-pink-100 border border-pink-400" /> Nữ</span>
                <span className="flex items-center gap-1"><span className="text-red-500">❤</span> Vợ chồng</span>
                <span className="flex items-center gap-1 opacity-60"><span className="w-2.5 h-2.5 rounded-sm bg-slate-200 border border-slate-400" /> Đã mất</span>
                <span className="ml-auto opacity-50">
                    {editorMode ? 'Kéo card để đổi cha/mẹ • Nhấn để chỉnh sửa' : 'Cuộn để zoom • Kéo để di chuyển • Nhấn để xem'}
                </span>
            </div>
            {/* Contribute dialog */}
            {contributePerson && (
                <ContributeDialog
                    personId={contributePerson.id}
                    personName={contributePerson.name}
                    onClose={() => setContributePerson(null)}
                />
            )}

            {/* Person detail panel */}
            {detailPerson && (
                <PersonDetailPanel
                    personId={detailPerson}
                    treeData={treeData}
                    onClose={() => setDetailPerson(null)}
                    onNavigate={(h) => setDetailPerson(h)}
                    onPersonUpdated={(h, fields) => {
                        setTreeData(prev => {
                            if (!prev) return null;
                            return {
                                ...prev,
                                people: prev.people.map(p => {
                                    if (p.id !== h) return p;
                                    return {
                                        ...p,
                                        ...(fields.displayName !== undefined && { displayName: fields.displayName }),
                                        ...(fields.birthYear !== undefined && { birthYear: fields.birthYear ?? undefined }),
                                        ...(fields.deathYear !== undefined && { deathYear: fields.deathYear ?? undefined }),
                                        ...(fields.isLiving !== undefined && { isLiving: fields.isLiving }),
                                    };
                                }),
                            };
                        });
                    }}
                />
            )}

            {/* Kinship mode: banner + result panel */}
            {kinshipMode && (
                <KinshipOverlay
                    selected={kinshipSelected}
                    result={kinshipResult}
                    people={treeData?.people || []}
                    onSwap={() => {
                        if (kinshipSelected.length === 2) {
                            setKinshipSelected([kinshipSelected[1], kinshipSelected[0]]);
                        }
                    }}
                    onDeselect={(handle) => {
                        setKinshipSelected(prev => prev.filter(h => h !== handle));
                    }}
                    onClose={() => { setKinshipMode(false); setKinshipSelected([]); setKinshipResult(null); }}
                />
            )}
        </div>
    );
}

// === Card Context Menu ===
function CardContextMenu({ person, x, y, canEdit, isLoggedIn, viewportRef, transform, onViewDetail, onShowDescendants, onShowAncestors, onSetFocus, onShowFull, onCopyLink, onContribute, onAddPerson, onKinship, onClose }: {
    person: TreeNode;
    x: number;
    y: number;
    canEdit: boolean;
    isLoggedIn: boolean;
    viewportRef: React.RefObject<HTMLDivElement | null>;
    transform: { x: number; y: number; scale: number };
    onViewDetail: () => void;
    onShowDescendants: () => void;
    onShowAncestors: () => void;
    onSetFocus: () => void;
    onShowFull: () => void;
    onCopyLink: () => void;
    onContribute: () => void;
    onAddPerson: () => void;
    onKinship: () => void;
    onClose: () => void;
}) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ left: 0, top: 0 });

    // Convert tree-space (x,y) to viewport-relative and clamp within bounds
    useEffect(() => {
        const vp = viewportRef.current;
        const menu = menuRef.current;
        if (!vp || !menu) return;
        const vpW = vp.clientWidth;
        const vpH = vp.clientHeight;
        // Tree-space → viewport-relative
        let posX = x * transform.scale + transform.x + 8;
        let posY = y * transform.scale + transform.y + 8;
        const menuW = menu.offsetWidth || 220;
        const menuH = menu.offsetHeight || 400;
        // Clamp so menu stays inside the viewport
        if (posX + menuW > vpW - 8) posX = vpW - menuW - 8;
        if (posX < 8) posX = 8;
        if (posY + menuH > vpH - 8) posY = vpH - menuH - 8;
        if (posY < 8) posY = 8;
        setPos({ left: posX, top: posY });
    }, [x, y, transform, viewportRef]);

    return (
        <div
            ref={menuRef}
            className="absolute z-50 animate-in fade-in zoom-in-95 duration-150"
            style={{ left: pos.left, top: pos.top }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div className="bg-white/95 backdrop-blur-lg border border-slate-200 rounded-xl shadow-xl
                py-1.5 min-w-[200px] max-h-[70vh] flex flex-col overflow-hidden">
                {/* Header with person info */}
                <div className="px-3 py-2 border-b border-slate-100 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                                ${person.isPatrilineal
                                    ? (person.gender === 1 ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700')
                                    : 'bg-slate-100 text-slate-500'}`}>
                                {person.displayName.split(' ').map(w => w[0]).join('').slice(0, 2)}
                            </div>
                            <span className="text-sm font-semibold text-slate-800 truncate max-w-[130px]">{person.displayName}</span>
                        </div>
                        <button onClick={onClose} className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    {/* Person details */}
                    <div className="mt-1.5 ml-9 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200/60 font-semibold">
                            Đời {person.generation}
                        </span>
                        {person.birthYear && (
                            <span className="text-slate-500">
                                {person.birthYear}{person.deathYear ? ` — ${person.deathYear}` : person.isLiving ? ' — nay' : ''}
                            </span>
                        )}
                        {person.isLiving ? (
                            <span className="text-emerald-600 font-medium">● Còn sống</span>
                        ) : (
                            <span className="text-slate-400">✝ Đã mất</span>
                        )}
                    </div>
                </div>

                {/* Actions — scrollable */}
                <div className="py-1 overflow-y-auto flex-1">
                    <MenuAction icon={<User className="w-4 h-4" />} label="Xem chi tiết" desc="Thông tin cá nhân & quan hệ" onClick={onViewDetail} />
                    <MenuAction icon={<ArrowDownToLine className="w-4 h-4" />} label="Hậu duệ từ đây" desc="Hiển thị cây con cháu" onClick={onShowDescendants} />
                    <MenuAction icon={<ArrowUpFromLine className="w-4 h-4" />} label="Tổ tiên" desc="Hiển thị dòng tổ tiên" onClick={onShowAncestors} />
                    <MenuAction icon={<Crosshair className="w-4 h-4" />} label="Căn giữa" desc="Di chuyển tới vị trí" onClick={onSetFocus} />
                    <MenuAction icon={<ArrowLeftRight className="w-4 h-4" />} label="Xưng hô" desc="Xác định cách gọi với người khác" onClick={onKinship} />
                    <div className="border-t border-slate-100 my-1" />
                    {canEdit && (
                        <>
                            <MenuAction icon={<UserPlus className="w-4 h-4" />} label="Thêm người thân" desc="Thêm con hoặc vợ/chồng" onClick={onAddPerson} />
                            <div className="border-t border-slate-100 my-1" />
                        </>
                    )}
                    <MenuAction icon={<Link className="w-4 h-4" />} label="Sao chép link hậu duệ" desc="Chia sẻ link cây con cháu" onClick={onCopyLink} />
                    <MenuAction icon={<Eye className="w-4 h-4" />} label="Toàn cảnh" desc="Hiển thị toàn bộ cây" onClick={onShowFull} />
                    <div className="border-t border-slate-100 my-1" />
                    <MenuAction icon={<MessageSquarePlus className="w-4 h-4" />} label="Đóng góp thông tin" desc="Bổ sung thông tin về người này" onClick={onContribute} />
                </div>
            </div>
        </div>
    );
}

function MenuAction({ icon, label, desc, onClick }: { icon: React.ReactNode; label: string; desc: string; onClick: () => void }) {
    return (
        <button
            className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-slate-50 active:bg-slate-100
                transition-colors text-left group"
            onClick={onClick}
        >
            <span className="text-slate-400 group-hover:text-blue-500 transition-colors flex-shrink-0">{icon}</span>
            <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-slate-700 group-hover:text-slate-900">{label}</p>
                <p className="text-[10px] text-slate-400">{desc}</p>
            </div>
        </button>
    );
}

// === Quick Add Person Dialog (full form from context menu) ===
function QuickAddPersonDialog({ person, x, y, viewportRef, transform, onSubmit, onClose, nextChildId, nextSpouseId, nextFamilyId, treeData }: {
    person: TreeNode;
    x: number;
    y: number;
    viewportRef: React.RefObject<HTMLDivElement | null>;
    transform: { x: number; y: number; scale: number };
    onSubmit: (data: {
        id: string; displayName: string; gender: number; generation: number;
        birthYear?: number; parentFamilyId?: string;
        nickName?: string; birthDate?: string; phone?: string;
        currentAddress?: string; education?: string; occupation?: string;
        notes?: string; title?: string; birthOrder?: number;
        maritalStatus?: string; bloodType?: string; isLiving?: boolean;
    }) => void;
    onClose: () => void;
    nextChildId: (generation: number) => string;
    nextSpouseId: (contextPersonHandle: string) => string;
    nextFamilyId: () => string;
    treeData: { people: TreeNode[]; families: TreeFamily[] } | null;
}) {
    const [type, setType] = useState<'child' | 'spouse'>('child');
    const [name, setName] = useState('');
    const [gender, setGender] = useState(1);
    const [birthDay, setBirthDay] = useState('');
    const [birthMonth, setBirthMonth] = useState('');
    const [birthYear, setBirthYear] = useState('');
    const [nickName, setNickName] = useState('');
    const [titleField, setTitleField] = useState('');
    const [phone, setPhone] = useState('');
    const [currentAddress, setCurrentAddress] = useState('');
    const [education, setEducation] = useState('');
    const [occupation, setOccupation] = useState('');
    const [maritalStatus, setMaritalStatus] = useState('');
    const [bloodType, setBloodType] = useState('');
    const [birthOrder, setBirthOrder] = useState('');
    const [notes, setNotes] = useState('');
    const [isDead, setIsDead] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ left: 0, top: 0, availH: 600 });

    // Auto-set gender when type changes
    useEffect(() => {
        if (type === 'spouse') {
            setGender(person.gender === 1 ? 2 : 1);
        } else {
            setGender(1);
        }
    }, [type, person.gender]);

    // Convert tree-space (x,y) to viewport-relative and clamp within bounds
    useEffect(() => {
        const vp = viewportRef.current;
        const dialog = dialogRef.current;
        if (!vp || !dialog) return;
        const vpW = vp.clientWidth;
        const vpH = vp.clientHeight;
        let posX = x * transform.scale + transform.x + 8;
        let posY = y * transform.scale + transform.y + 8;
        const dW = dialog.offsetWidth || 480;

        // Clamp X within viewport
        if (posX + dW > vpW - 8) posX = vpW - dW - 8;
        if (posX < 8) posX = 8;

        // Clamp Y — ensure at least 300px visible
        if (posY < 8) posY = 8;
        if (posY > vpH - 300) posY = Math.max(8, vpH - 300);

        // Calculate available height from posY to bottom of viewport
        const availH = Math.max(vpH - posY - 8, 300);

        setPos({ left: posX, top: posY, availH });
    }, [x, y, transform, viewportRef]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !treeData) return;

        const generation = type === 'child' ? person.generation + 1 : person.generation;
        const handle = type === 'spouse'
            ? nextSpouseId(person.id)
            : nextChildId(generation);

        let familyId: string | undefined;
        if (type === 'child') {
            const existingFamily = treeData.families.find(f => f.fatherId === person.id || f.motherId === person.id);
            familyId = existingFamily?.id || nextFamilyId();
        } else {
            familyId = nextFamilyId();
        }

        // Build birthDate string from day/month/year
        let birthDate: string | undefined;
        if (birthDay || birthMonth || birthYear) {
            const parts = [];
            if (birthDay) parts.push(birthDay.padStart(2, '0'));
            if (birthMonth) parts.push(birthMonth.padStart(2, '0'));
            if (birthYear) parts.push(birthYear);
            birthDate = parts.join('/');
        }

        onSubmit({
            id: handle,
            displayName: name.trim(),
            gender,
            generation,
            birthYear: birthYear ? parseInt(birthYear) : undefined,
            parentFamilyId: familyId,
            nickName: nickName || undefined,
            birthDate,
            phone: phone || undefined,
            currentAddress: currentAddress || undefined,
            education: education || undefined,
            occupation: occupation || undefined,
            notes: notes || undefined,
            title: titleField || undefined,
            birthOrder: birthOrder ? parseInt(birthOrder) : undefined,
            maritalStatus: maritalStatus || undefined,
            bloodType: bloodType || undefined,
            isLiving: !isDead,
        });
    };

    const [showMore, setShowMore] = useState(false);
    const inputCls = "w-full px-2 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-300 bg-white";
    const labelCls = "text-[10px] font-medium text-slate-500 block mb-0.5";

    return (
        <div
            ref={dialogRef}
            className="absolute z-50 animate-in fade-in zoom-in-95 duration-150"
            style={{ left: pos.left, top: pos.top }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div className="bg-white/95 backdrop-blur-lg border border-slate-200 rounded-xl shadow-2xl
                w-[calc(100vw-24px)] sm:w-[440px] flex flex-col"
                style={{ maxHeight: `${pos.availH}px` }}>
                {/* Header */}
                <div className="flex items-center justify-between px-3 sm:px-4 pt-3 pb-2 shrink-0 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-semibold text-slate-800">Thêm người thân</span>
                        <span className="text-[10px] text-slate-400">
                            ({type === 'child' ? 'con' : 'vợ/chồng'} của {person.displayName})
                        </span>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-2.5">

                <form onSubmit={handleSubmit} className="space-y-2" id="quick-add-form">
                    {/* Row 1: Relationship type + Gender */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className={labelCls}>Quan hệ</label>
                            <div className="flex gap-1">
                                <button type="button"
                                    className={`flex-1 px-2 py-1 text-[11px] font-medium rounded-md border transition-colors flex items-center justify-center gap-1 ${
                                        type === 'child' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                                    }`}
                                    onClick={() => setType('child')}>
                                    <Baby className="w-3 h-3" /> Con
                                </button>
                                <button type="button"
                                    className={`flex-1 px-2 py-1 text-[11px] font-medium rounded-md border transition-colors flex items-center justify-center gap-1 ${
                                        type === 'spouse' ? 'bg-rose-50 border-rose-300 text-rose-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                                    }`}
                                    onClick={() => setType('spouse')}>
                                    <Heart className="w-3 h-3" /> Vợ/Chồng
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className={labelCls}>Giới tính</label>
                            <div className="flex gap-1">
                                <button type="button"
                                    className={`flex-1 px-2 py-1 text-[11px] font-medium rounded-md border transition-colors ${gender === 1 ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                    onClick={() => setGender(1)}>Nam</button>
                                <button type="button"
                                    className={`flex-1 px-2 py-1 text-[11px] font-medium rounded-md border transition-colors ${gender === 2 ? 'bg-pink-50 border-pink-300 text-pink-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                    onClick={() => setGender(2)}>Nữ</button>
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Full name */}
                    <div>
                        <label className={labelCls}>Họ và tên <span className="text-red-400">*</span></label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Duy..." className={inputCls} autoFocus />
                    </div>

                    {/* Row 3: Birth date + Birth order */}
                    <div className="grid grid-cols-4 gap-2">
                        <div>
                            <label className={labelCls}>Ngày sinh</label>
                            <input type="number" value={birthDay} onChange={(e) => setBirthDay(e.target.value)} placeholder="DD" min="1" max="31" className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Tháng</label>
                            <input type="number" value={birthMonth} onChange={(e) => setBirthMonth(e.target.value)} placeholder="MM" min="1" max="12" className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Năm</label>
                            <input type="number" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} placeholder="YYYY" className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Con thứ</label>
                            <input type="number" value={birthOrder} onChange={(e) => setBirthOrder(e.target.value)} placeholder="1,2.." min="1" className={inputCls} />
                        </div>
                    </div>

                    {/* Row 4: Phone + Is dead */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className={labelCls}>Số điện thoại</label>
                            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0912..." className={inputCls} />
                        </div>
                        <div className="flex items-end pb-0.5">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={isDead} onChange={(e) => setIsDead(e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-400" />
                                <span className="text-[11px] text-slate-600">Đã mất</span>
                            </label>
                        </div>
                    </div>

                    {/* Toggle more fields */}
                    <button type="button" onClick={() => setShowMore(!showMore)}
                        className="w-full flex items-center justify-center gap-1 py-1 text-[11px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors">
                        <ChevronDown className={`w-3 h-3 transition-transform ${showMore ? 'rotate-180' : ''}`} />
                        {showMore ? 'Ẩn bớt' : 'Thông tin thêm'}
                    </button>

                    {showMore && (
                        <div className="space-y-2 pt-1 border-t border-slate-100">
                            {/* Nick name + Title */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className={labelCls}>Tên gọi khác</label>
                                    <input type="text" value={nickName} onChange={(e) => setNickName(e.target.value)} placeholder="Biệt danh..." className={inputCls} />
                                </div>
                                <div>
                                    <label className={labelCls}>Chức danh</label>
                                    <input type="text" value={titleField} onChange={(e) => setTitleField(e.target.value)} placeholder="Trưởng tộc..." className={inputCls} />
                                </div>
                            </div>

                            {/* Address */}
                            <div>
                                <label className={labelCls}>Địa chỉ</label>
                                <input type="text" value={currentAddress} onChange={(e) => setCurrentAddress(e.target.value)} placeholder="Số nhà, đường, phường..." className={inputCls} />
                            </div>

                            {/* Occupation + Education */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className={labelCls}>Nghề nghiệp</label>
                                    <input type="text" value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="Giáo viên..." className={inputCls} />
                                </div>
                                <div>
                                    <label className={labelCls}>Học vấn</label>
                                    <input type="text" value={education} onChange={(e) => setEducation(e.target.value)} placeholder="Đại học..." className={inputCls} />
                                </div>
                            </div>

                            {/* Marital status + Blood type */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className={labelCls}>Hôn nhân</label>
                                    <select value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)} className={inputCls}>
                                        <option value="">— Chọn —</option>
                                        <option value="single">Độc thân</option>
                                        <option value="married">Đã kết hôn</option>
                                        <option value="divorced">Đã ly hôn</option>
                                        <option value="widowed">Góa</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>Nhóm máu</label>
                                    <select value={bloodType} onChange={(e) => setBloodType(e.target.value)} className={inputCls}>
                                        <option value="">— Chọn —</option>
                                        <option value="A">A</option>
                                        <option value="B">B</option>
                                        <option value="AB">AB</option>
                                        <option value="O">O</option>
                                    </select>
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className={labelCls}>Tiểu sử / Ghi chú</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Ghi chú về tiểu sử..."
                                    rows={2}
                                    className={`${inputCls} resize-none`}
                                />
                            </div>
                        </div>
                    )}

                </form>
                </div>

                {/* Footer buttons — always visible */}
                <div className="flex gap-2 px-3 sm:px-4 py-2.5 border-t border-slate-200 shrink-0 bg-slate-50/80">
                    <button type="button" onClick={onClose}
                        className="flex-1 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
                        Hủy bỏ
                    </button>
                    <button type="submit" form="quick-add-form" disabled={!name.trim()}
                        className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5">
                        <Save className="w-3.5 h-3.5" />
                        Lưu lại
                    </button>
                </div>
            </div>
        </div>
    );
}

// === Person Card Component (memoized) ===
const MemoPersonCard = memo(PersonCard, (prev, next) =>
    prev.item === next.item &&
    prev.isHighlighted === next.isHighlighted &&
    prev.isFocused === next.isFocused &&
    prev.isHovered === next.isHovered &&
    prev.isSelected === next.isSelected &&
    prev.isKinshipA === next.isKinshipA &&
    prev.isKinshipPath === next.isKinshipPath &&
    prev.kinshipMode === next.kinshipMode &&
    prev.zoomLevel === next.zoomLevel &&
    prev.showCollapseToggle === next.showCollapseToggle &&
    prev.isCollapsed === next.isCollapsed &&
    prev.isDragging === next.isDragging &&
    prev.isDropTarget === next.isDropTarget &&
    prev.editorMode === next.editorMode
);

function PersonCard({ item, isHighlighted, isFocused, isHovered, isSelected, isKinshipA, isKinshipPath, kinshipMode, zoomLevel, showCollapseToggle, isCollapsed, isDragging, isDropTarget, editorMode, onHover, onClick, onSetFocus, onToggleCollapse, onDragStart }: {
    item: PositionedNode;
    isHighlighted: boolean;
    isFocused: boolean;
    isHovered: boolean;
    isSelected: boolean;
    isKinshipA: boolean;
    isKinshipPath: boolean;
    kinshipMode: boolean;
    zoomLevel: ZoomLevel;
    showCollapseToggle: boolean;
    isCollapsed: boolean;
    isDragging: boolean;
    isDropTarget: boolean;
    editorMode: boolean;
    onHover: (h: string | null) => void;
    onClick: (handle: string, x: number, y: number) => void;
    onSetFocus: (handle: string) => void;
    onToggleCollapse: (handle: string) => void;
    onDragStart: (handle: string, clientX: number, clientY: number) => void;
}) {
    const { node, x, y } = item;
    const isMale = node.gender === 1;
    const isFemale = node.gender === 2;
    const isDead = !node.isLiving;
    const isPatri = node.isPatrilineal;

    // ── Color system ──
    const dotColor = !isPatri ? '#94a3b8' : isMale ? '#818cf8' : isFemale ? '#f472b6' : '#94a3b8';

    // F1: MINI zoom → just a colored dot with tooltip
    if (zoomLevel === 'mini') {
        return (
            <div
                className="absolute group"
                style={{ left: x + CARD_W / 2 - 6, top: y + CARD_H / 2 - 6, width: 12, height: 12 }}
                onMouseEnter={() => onHover(node.id)}
                onMouseLeave={() => onHover(null)}
                onClick={(e) => { e.stopPropagation(); onClick(node.id, x + CARD_W, y + CARD_H / 2); }}
            >
                <div className={`w-3 h-3 rounded-full shadow-sm ${isKinshipA ? 'ring-2 ring-emerald-400 ring-offset-1' : ''}`} style={{ backgroundColor: dotColor }} />
                {isKinshipA && <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center shadow-md"><span className="text-white text-[8px] font-bold">✓</span></div>}
                {/* Tooltip on hover */}
                <div className="hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 z-50
                    bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap pointer-events-none">
                    {node.displayName} · Đời {node.generation}
                </div>
            </div>
        );
    }

    // Extract initials
    const nameParts = node.displayName.split(' ');
    const initials = nameParts.length >= 2
        ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
        : node.displayName.slice(0, 2).toUpperCase();

    const avatarBg = !isPatri
        ? 'bg-stone-300 text-stone-600'
        : isMale
            ? (isDead ? 'bg-indigo-300 text-indigo-800' : 'bg-indigo-400 text-white')
            : isFemale
                ? (isDead ? 'bg-rose-300 text-rose-800' : 'bg-rose-400 text-white')
                : 'bg-slate-300 text-slate-600';

    const bgClass = !isPatri
        ? 'from-stone-50 to-stone-100 border-stone-300/80 border-dashed'
        : isDead
            ? (isMale
                ? 'from-indigo-50/60 to-slate-50 border-indigo-300/60'
                : 'from-rose-50/60 to-slate-50 border-rose-300/60')
            : isMale
                ? 'from-indigo-50 to-violet-50 border-indigo-300'
                : isFemale
                    ? 'from-rose-50 to-pink-50 border-rose-300'
                    : 'from-slate-50 to-slate-100 border-slate-300';

    const glowClass = isDropTarget ? 'ring-2 ring-green-500 ring-offset-2 shadow-green-200 shadow-lg scale-105'
        : isDragging ? 'opacity-40 ring-2 ring-blue-300 ring-dashed'
        : isKinshipA ? 'ring-2 ring-emerald-500 ring-offset-2 shadow-emerald-200 shadow-lg'
        : isKinshipPath ? 'ring-2 ring-amber-400 ring-offset-1 shadow-amber-100 shadow-md'
        : isSelected ? 'ring-2 ring-blue-500 ring-offset-2 shadow-blue-200 shadow-lg'
        : isHighlighted ? 'ring-2 ring-amber-400 ring-offset-2'
            : isFocused ? 'ring-2 ring-indigo-400 ring-offset-2'
                : kinshipMode && isHovered ? 'ring-2 ring-emerald-300 ring-offset-1 cursor-crosshair'
                : isHovered ? 'ring-1 ring-indigo-200' : '';

    // F1: COMPACT zoom → smaller card with just name + gen
    if (zoomLevel === 'compact') {
        return (
            <div
                className={`absolute rounded-lg border bg-gradient-to-br shadow-sm transition-all duration-200
                    ${editorMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} hover:shadow-md ${bgClass} ${glowClass}
                    ${isDead && !isDragging ? 'opacity-70' : ''} ${!isPatri && !isDragging ? 'opacity-80' : ''}`}
                style={{ left: x, top: y, width: CARD_W, height: CARD_H }}
                onMouseEnter={() => onHover(node.id)}
                onMouseLeave={() => onHover(null)}
                onClick={(e) => { e.stopPropagation(); onClick(node.id, x + CARD_W, y + CARD_H / 2); }}
                onMouseDown={(e) => { if (editorMode && e.button === 0) { e.stopPropagation(); onDragStart(node.id, e.clientX, e.clientY); } }}
            >
                <div className="px-2 py-1.5 h-full flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center
                        font-bold text-[9px] shadow-sm ring-1 ring-black/5 ${avatarBg} flex-shrink-0`}>
                        {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[10px] leading-tight text-slate-800 line-clamp-2">{node.displayName}</p>
                        <span className="text-[8px] font-semibold px-0.5 py-px rounded bg-amber-100 text-amber-700">Đời {node.generation}</span>
                    </div>
                </div>
                {/* Kinship tick badge */}
                {isKinshipA && (
                    <div className="absolute -top-2 -right-2 z-10 w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shadow-md border-2 border-white">
                        <span className="text-white text-sm font-bold">✓</span>
                    </div>
                )}
                {/* Collapse toggle */}
                {showCollapseToggle && (
                    <button
                        className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-10 w-5 h-5 rounded-full
                            bg-white border border-slate-300 shadow-sm flex items-center justify-center
                            hover:bg-slate-100 transition-colors"
                        onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.id); }}
                    >
                        {isCollapsed ? <ChevronRight className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
                    </button>
                )}
            </div>
        );
    }

    // F1: FULL zoom → original detailed card
    return (
        <div
            className={`absolute rounded-xl border-[1.5px] bg-gradient-to-br shadow-sm transition-all duration-200
                ${editorMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} hover:shadow-md hover:-translate-y-0.5 ${bgClass} ${glowClass}
                ${isDead && !isDragging ? 'opacity-70' : ''} ${!isPatri && !isDragging ? 'opacity-80' : ''}`}
            style={{ left: x, top: y, width: CARD_W, height: CARD_H }}
            onMouseEnter={() => onHover(node.id)}
            onMouseLeave={() => onHover(null)}
            onClick={(e) => { e.stopPropagation(); onClick(node.id, x + CARD_W, y + CARD_H / 2); }}
            onMouseDown={(e) => { if (editorMode && e.button === 0) { e.stopPropagation(); onDragStart(node.id, e.clientX, e.clientY); } }}
            onContextMenu={(e) => { e.preventDefault(); onSetFocus(node.id); }}
        >
            <div className="px-2.5 py-2 h-full flex items-center gap-2.5">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center
                        font-bold text-sm shadow-sm ring-1 ring-black/5 ${avatarBg} ${isDead ? 'opacity-60' : ''}`}>
                        {initials}
                    </div>
                    {isPatri && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500
                            text-white text-[7px] flex items-center justify-center shadow-sm font-bold ring-1 ring-white">ND</span>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[11px] leading-tight text-slate-800 line-clamp-2">
                        {node.displayName}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                        {node.birthYear
                            ? `${node.birthYear}${node.deathYear ? ` — ${node.deathYear}` : node.isLiving ? ' — nay' : ''}`
                            : '—'}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1">
                        <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200/60">Đời {node.generation}</span>
                        {isDead ? (
                            <span className="text-[9px] text-slate-400">✝ Đã mất</span>
                        ) : (
                            <span className="text-[9px] text-emerald-600 font-medium">● Còn sống</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Kinship tick badge */}
            {isKinshipA && (
                <div className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg border-2 border-white">
                    <span className="text-white text-base font-bold">✓</span>
                </div>
            )}

            {/* F4: Collapse toggle button */}
            {showCollapseToggle && (
                <button
                    className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10 w-6 h-6 rounded-full
                        bg-white border border-slate-300 shadow-sm flex items-center justify-center
                        hover:bg-amber-50 hover:border-amber-400 transition-colors"
                    onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.id); }}
                    title={isCollapsed ? 'Mở rộng nhánh' : 'Thu gọn nhánh'}
                >
                    {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-amber-600" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
                </button>
            )}
        </div>
    );
}

// === F4: Branch Summary Card ===
function BranchSummaryCard({ summary, parentNode, zoomLevel, onExpand }: {
    summary: BranchSummary;
    parentNode: PositionedNode;
    zoomLevel: ZoomLevel;
    onExpand: () => void;
}) {
    const x = parentNode.x;
    const y = parentNode.y + CARD_H + 40; // Position below parent with spacing

    if (zoomLevel === 'mini') {
        return (
            <div
                className="absolute group cursor-pointer"
                style={{ left: x + CARD_W / 2 - 8, top: y + CARD_H / 2 - 8, width: 16, height: 16 }}
                onClick={(e) => { e.stopPropagation(); onExpand(); }}
            >
                <div className="w-4 h-4 rounded bg-amber-400 shadow-sm flex items-center justify-center">
                    <span className="text-[7px] text-white font-bold">{summary.totalDescendants}</span>
                </div>
                <div className="hidden group-hover:block absolute -top-10 left-1/2 -translate-x-1/2 z-50
                    bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap pointer-events-none">
                    📦 {summary.totalDescendants} người · Đời {summary.generationRange[0]}→{summary.generationRange[1]}
                </div>
            </div>
        );
    }

    return (
        <div
            className="absolute rounded-xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50
                shadow-md cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
            style={{ left: x, top: y, width: CARD_W, height: CARD_H }}
            onClick={(e) => { e.stopPropagation(); onExpand(); }}
        >
            <div className="px-2.5 py-2 h-full flex items-center gap-2.5">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-orange-500
                    flex items-center justify-center shadow-sm flex-shrink-0">
                    <Package className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[11px] leading-tight text-amber-900">
                        📦 {summary.totalDescendants} người
                    </p>
                    <p className="text-[10px] text-amber-700 mt-0.5">
                        Đời {summary.generationRange[0]} → {summary.generationRange[1]}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[9px]">
                        <span className="text-emerald-600 font-medium">● {summary.livingCount}</span>
                        <span className="text-slate-400">✝ {summary.deceasedCount}</span>
                        <span className="text-amber-600 ml-auto text-[8px] font-medium">▶ Mở</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// === F2: Generation Row Headers ===
function GenerationHeaders({ generationStats, transform, cardH }: {
    generationStats: Map<number, { count: number; y: number }>;
    transform: { x: number; y: number; scale: number };
    cardH: number;
}) {
    const entries = Array.from(generationStats.entries()).sort((a, b) => a[0] - b[0]);
    if (entries.length === 0) return null;

    return (
        <div className="absolute left-0 top-0 bottom-0 overflow-hidden pointer-events-none" style={{ width: 100 }}>
            {entries.map(([gen, { count, y: rowY }]) => {
                const screenY = rowY * transform.scale + transform.y;
                // Only render if in viewport
                if (screenY < -60 || screenY > 2000) return null;
                return (
                    <div
                        key={gen}
                        className="absolute left-0 flex items-center text-[10px] transition-transform duration-100"
                        style={{
                            top: screenY + (cardH * transform.scale) / 2 - 10,
                            height: 20,
                        }}
                    >
                        <div className="bg-slate-800/70 backdrop-blur text-white px-2 py-0.5 rounded-r-md
                            font-medium whitespace-nowrap shadow-sm">
                            Đ{gen} <span className="opacity-70">· {count}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// === F3: Stats Overlay Panel ===
function StatsOverlay({ stats, onClose }: { stats: TreeStats; onClose: () => void }) {
    const maxCount = Math.max(...stats.perGeneration.map(g => g.count));

    return (
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 w-56 sm:w-64 bg-white/95 backdrop-blur-lg border border-slate-200
            rounded-xl shadow-xl animate-in slide-in-from-right-5 fade-in duration-300 z-40 pointer-events-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                <div className="flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-indigo-500" />
                    <span className="font-semibold text-sm text-slate-800">Tổng quan</span>
                </div>
                <button onClick={onClose} className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            <div className="p-3 space-y-3">
                {/* Summary numbers */}
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                        <p className="text-lg font-bold text-slate-800">{stats.total}</p>
                        <p className="text-[9px] text-slate-500">Thành viên</p>
                    </div>
                    <div>
                        <p className="text-lg font-bold text-slate-800">{stats.totalGenerations}</p>
                        <p className="text-[9px] text-slate-500">Thế hệ</p>
                    </div>
                    <div>
                        <p className="text-lg font-bold text-slate-800">{stats.totalFamilies}</p>
                        <p className="text-[9px] text-slate-500">Gia đình</p>
                    </div>
                </div>

                {/* Generation distribution */}
                <div>
                    <p className="text-[10px] font-semibold text-slate-600 mb-1.5">Phân bố theo đời</p>
                    <div className="space-y-1">
                        {stats.perGeneration.map(({ gen, count }) => (
                            <div key={gen} className="flex items-center gap-1.5 text-[10px]">
                                <span className="w-6 text-right text-slate-500 font-mono">Đ{gen}</span>
                                <div className="flex-1 h-3 bg-slate-100 rounded-sm overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-indigo-400 to-violet-500 rounded-sm transition-all"
                                        style={{ width: `${(count / maxCount) * 100}%` }}
                                    />
                                </div>
                                <span className="w-6 text-slate-600 font-medium">{count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Status breakdown */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-slate-600">Còn sống</span>
                        <span className="ml-auto font-medium text-slate-800">{stats.livingCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-slate-300" />
                        <span className="text-slate-600">Đã mất</span>
                        <span className="ml-auto font-medium text-slate-800">{stats.deceasedCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-400" />
                        <span className="text-slate-600">Đinh (Nam)</span>
                        <span className="ml-auto font-medium text-slate-800">{stats.maleCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-pink-400" />
                        <span className="text-slate-600">Thị (Nữ)</span>
                        <span className="ml-auto font-medium text-slate-800">{stats.femaleCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-indigo-400" />
                        <span className="text-slate-600">Chính tộc</span>
                        <span className="ml-auto font-medium text-slate-800">{stats.patrilinealCount}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// === Editor Panel Component ===
function EditorPanel({ selectedCard, treeData, onReorderChildren, onMoveChild, onRemoveChild, onToggleLiving, onUpdatePerson, onAddPerson, onDeletePerson, onReset, onClose }: {
    selectedCard: string | null;
    treeData: { people: TreeNode[]; families: TreeFamily[] } | null;
    onReorderChildren: (familyId: string, newOrder: string[]) => void;
    onMoveChild: (childId: string, fromFamily: string, toFamily: string) => void;
    onRemoveChild: (childId: string, familyId: string) => void;
    onToggleLiving: (handle: string, isLiving: boolean) => void;
    onUpdatePerson: (handle: string, fields: Record<string, unknown>) => void;
    onAddPerson: (person: { id: string; displayName: string; gender: number; generation: number; birthYear?: number; parentFamilyId?: string }) => void;
    onDeletePerson: (handle: string) => void;
    onReset: () => void;
    onClose: () => void;
}) {
    const [editName, setEditName] = useState('');
    const [editBirthYear, setEditBirthYear] = useState('');
    const [editDeathYear, setEditDeathYear] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editAddress, setEditAddress] = useState('');
    const [editOccupation, setEditOccupation] = useState('');
    const [editEducation, setEditEducation] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [parentSearch, setParentSearch] = useState('');
    const [showParentDropdown, setShowParentDropdown] = useState(false);
    const [showExtended, setShowExtended] = useState(false);
    const [showAddChild, setShowAddChild] = useState(false);
    const [newChildName, setNewChildName] = useState('');
    const [newChildGender, setNewChildGender] = useState(1);
    const [newChildBirthYear, setNewChildBirthYear] = useState('');
    const [showAddSpouse, setShowAddSpouse] = useState(false);
    const [newSpouseName, setNewSpouseName] = useState('');
    const [newSpouseBirthYear, setNewSpouseBirthYear] = useState('');
    const parentSearchRef = useRef<HTMLDivElement>(null);

    if (!treeData) return null;

    const person = selectedCard ? treeData.people.find(p => p.id === selectedCard) : null;

    // Sync local state when selection changes
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
        if (person) {
            setEditName(person.displayName || '');
            setEditBirthYear(person.birthYear?.toString() || '');
            setEditDeathYear(person.deathYear?.toString() || '');
            setEditPhone('');
            setEditEmail('');
            setEditAddress('');
            setEditOccupation('');
            setEditEducation('');
            setEditNotes('');
            setDirty(false);
            setParentSearch('');
            setShowParentDropdown(false);
            setShowExtended(false);
            setShowAddChild(false);
            setShowAddSpouse(false);
        }
    }, [person?.id]);

    // Close parent dropdown on outside click
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (parentSearchRef.current && !parentSearchRef.current.contains(e.target as Node)) {
                setShowParentDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Find the family where this person is a parent
    const parentFamily = person
        ? treeData.families.find(f => f.fatherId === person.id || f.motherId === person.id)
        : null;

    // Find the family where this person is a child
    const childOfFamily = person
        ? treeData.families.find(f => f.childIds.includes(person.id))
        : null;

    // Get parent person name
    const parentPerson = childOfFamily
        ? treeData.people.find(p => p.id === childOfFamily.fatherId || p.id === childOfFamily.motherId)
        : null;

    // Children of the selected person's family
    const children = parentFamily
        ? parentFamily.childIds.map(ch => treeData.people.find(p => p.id === ch)).filter(Boolean) as TreeNode[]
        : [];

    // All families (for "change parent" dropdown) with labels
    const allParentFamilies = treeData.families.filter(f => f.fatherId || f.motherId);
    const parentFamiliesWithLabels = allParentFamilies.map(f => {
        const father = treeData.people.find(p => p.id === f.fatherId);
        const gen = father ? (father as any).generation : '';
        const label = father ? father.displayName : f.id;
        return { ...f, label, gen };
    });

    // Filter parent families by search term
    const filteredParentFamilies = parentSearch.trim()
        ? parentFamiliesWithLabels.filter(f =>
            f.label.toLowerCase().includes(parentSearch.toLowerCase()) ||
            f.id.toLowerCase().includes(parentSearch.toLowerCase())
        )
        : parentFamiliesWithLabels;

    // Generate next handle (Dxx-yyy format for children, S_Dxx-yyy for spouses)
    const nextChildIdEditor = (generation: number) => {
        const genStr = String(generation).padStart(2, '0');
        const prefix = `D${genStr}-`;
        const maxIdx = treeData.people
            .filter(p => p.id.startsWith(prefix))
            .reduce((max, p) => {
                const idx = parseInt(p.id.replace(prefix, '')) || 0;
                return Math.max(max, idx);
            }, 0);
        return `${prefix}${String(maxIdx + 1).padStart(3, '0')}`;
    };

    const nextSpouseIdEditor = (contextPersonHandle: string) => {
        return `S_${contextPersonHandle}`;
    };

    const nextFamilyId = () => {
        const maxNum = treeData.families.reduce((max, f) => {
            const num = parseInt(f.id.replace(/\D/g, '')) || 0;
            return Math.max(max, num);
        }, 0);
        return `F${String(maxNum + 1).padStart(3, '0')}`;
    };

    const handleSave = async () => {
        if (!person || !dirty) return;
        setSaving(true);
        const fields: Record<string, unknown> = {};
        if (editName !== person.displayName) fields.displayName = editName;
        const newBirth = editBirthYear ? parseInt(editBirthYear) : null;
        if (newBirth !== (person.birthYear ?? null)) fields.birthYear = newBirth;
        const newDeath = editDeathYear ? parseInt(editDeathYear) : null;
        if (newDeath !== (person.deathYear ?? null)) fields.deathYear = newDeath;
        if (editPhone) fields.phone = editPhone;
        if (editEmail) fields.email = editEmail;
        if (editAddress) fields.currentAddress = editAddress;
        if (editOccupation) fields.occupation = editOccupation;
        if (editEducation) fields.education = editEducation;
        if (editNotes) fields.notes = editNotes;
        if (Object.keys(fields).length > 0) {
            onUpdatePerson(person.id, fields);
        }
        setDirty(false);
        setSaving(false);
    };

    const handleAddChild = () => {
        if (!person || !newChildName.trim()) return;
        const generation = (person as any).generation + 1;
        const handle = nextChildIdEditor(generation);
        let familyId = parentFamily?.id;

        // If person has no family yet, create one
        if (!familyId) {
            familyId = nextFamilyId();
        }

        onAddPerson({
            id: handle,
            displayName: newChildName.trim(),
            gender: newChildGender,
            generation,
            birthYear: newChildBirthYear ? parseInt(newChildBirthYear) : undefined,
            parentFamilyId: familyId,
        });

        setNewChildName('');
        setNewChildGender(1);
        setNewChildBirthYear('');
        setShowAddChild(false);
    };

    const handleAddSpouse = () => {
        if (!person || !newSpouseName.trim()) return;
        const generation = (person as any).generation;
        const handle = nextSpouseIdEditor(person.id);
        const familyId = parentFamily?.id || nextFamilyId();

        onAddPerson({
            id: handle,
            displayName: newSpouseName.trim(),
            gender: person.gender === 1 ? 2 : 1, // opposite gender
            generation,
            birthYear: newSpouseBirthYear ? parseInt(newSpouseBirthYear) : undefined,
            parentFamilyId: familyId,
        });

        setNewSpouseName('');
        setNewSpouseBirthYear('');
        setShowAddSpouse(false);
    };

    return (
        <div className="w-72 sm:w-80 bg-background border-l flex flex-col overflow-hidden flex-shrink-0">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b bg-blue-50">
                <div className="flex items-center gap-2">
                    <Pencil className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-800">Chỉnh sửa</span>
                </div>
                <div className="flex gap-1">
                    <button onClick={onReset} title="Khôi phục gốc" className="p-1 rounded hover:bg-blue-100 text-blue-600">
                        <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={onClose} className="p-1 rounded hover:bg-blue-100 text-blue-600">
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {!person ? (
                <div className="flex-1 flex items-center justify-center p-4">
                    <p className="text-sm text-muted-foreground text-center">
                        Nhấn vào một card trên cây để chọn và chỉnh sửa
                    </p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto">
                    {/* Editable person info */}
                    <div className="p-3 border-b space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">Đời {(person as any).generation ?? '?'} · {person.id}</p>
                            <button
                                className="text-[10px] px-1.5 py-0.5 rounded text-red-600 hover:bg-red-50 border border-red-200"
                                onClick={() => {
                                    if (confirm(`Xóa "${person.displayName}" khỏi gia phả? Hành động này không thể hoàn tác.`)) {
                                        onDeletePerson(person.id);
                                    }
                                }}
                            >
                                <Trash2 className="h-3 w-3 inline mr-0.5" />Xóa
                            </button>
                        </div>
                        {parentPerson && (
                            <p className="text-xs text-muted-foreground">
                                Cha: <span className="font-medium text-foreground">{parentPerson.displayName}</span>
                            </p>
                        )}

                        {/* Editable Name */}
                        <div>
                            <label className="text-xs text-muted-foreground">Họ tên</label>
                            <input className="w-full border rounded px-2 py-1 text-sm bg-background" value={editName}
                                onChange={e => { setEditName(e.target.value); setDirty(true); }} />
                        </div>

                        {/* Birth / Death Year */}
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="text-xs text-muted-foreground">Năm sinh</label>
                                <input type="number" className="w-full border rounded px-2 py-1 text-sm bg-background" value={editBirthYear}
                                    onChange={e => { setEditBirthYear(e.target.value); setDirty(true); }} placeholder="—" />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs text-muted-foreground">Năm mất</label>
                                <input type="number" className="w-full border rounded px-2 py-1 text-sm bg-background" value={editDeathYear}
                                    onChange={e => { setEditDeathYear(e.target.value); setDirty(true); }} placeholder="—" />
                            </div>
                        </div>

                        {/* Living status */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Trạng thái:</span>
                            <button
                                className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${person.isLiving
                                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    }`}
                                onClick={() => onToggleLiving(person.id, !person.isLiving)}
                            >
                                {person.isLiving ? '● Còn sống' : '○ Đã mất'}
                            </button>
                        </div>

                        {/* Extended fields toggle */}
                        <button
                            className="w-full text-xs text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1 py-1"
                            onClick={() => setShowExtended(!showExtended)}
                        >
                            <ChevronDown className={`h-3 w-3 transition-transform ${showExtended ? 'rotate-180' : ''}`} />
                            {showExtended ? 'Ẩn thông tin mở rộng' : 'Thông tin mở rộng'}
                        </button>

                        {/* Extended fields */}
                        {showExtended && (
                            <div className="space-y-2 pt-1 border-t">
                                <div>
                                    <label className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> Điện thoại</label>
                                    <input className="w-full border rounded px-2 py-1 text-sm bg-background" value={editPhone}
                                        onChange={e => { setEditPhone(e.target.value); setDirty(true); }} placeholder="0901234567" />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> Email</label>
                                    <input className="w-full border rounded px-2 py-1 text-sm bg-background" value={editEmail}
                                        onChange={e => { setEditEmail(e.target.value); setDirty(true); }} placeholder="email@example.com" />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Địa chỉ</label>
                                    <input className="w-full border rounded px-2 py-1 text-sm bg-background" value={editAddress}
                                        onChange={e => { setEditAddress(e.target.value); setDirty(true); }} placeholder="Hà Nội" />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground flex items-center gap-1"><Briefcase className="h-3 w-3" /> Nghề nghiệp</label>
                                    <input className="w-full border rounded px-2 py-1 text-sm bg-background" value={editOccupation}
                                        onChange={e => { setEditOccupation(e.target.value); setDirty(true); }} placeholder="Giáo viên" />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground flex items-center gap-1"><GraduationCap className="h-3 w-3" /> Học vấn</label>
                                    <input className="w-full border rounded px-2 py-1 text-sm bg-background" value={editEducation}
                                        onChange={e => { setEditEducation(e.target.value); setDirty(true); }} placeholder="Đại học" />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground flex items-center gap-1"><StickyNote className="h-3 w-3" /> Ghi chú</label>
                                    <textarea className="w-full border rounded px-2 py-1 text-sm bg-background min-h-[60px] resize-y" value={editNotes}
                                        onChange={e => { setEditNotes(e.target.value); setDirty(true); }} placeholder="Ghi chú..." />
                                </div>
                            </div>
                        )}

                        {/* Save button */}
                        {dirty && (
                            <button
                                className="w-full flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                                onClick={handleSave} disabled={saving}
                            >
                                <Save className="h-3.5 w-3.5" />{saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                            </button>
                        )}
                    </div>

                    {/* Children reorder + Add child */}
                    <div className="p-3 border-b">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Con ({children.length})
                            </p>
                            <button
                                className="text-[10px] px-1.5 py-0.5 rounded text-green-600 hover:bg-green-50 border border-green-200 flex items-center gap-0.5"
                                onClick={() => setShowAddChild(!showAddChild)}
                            >
                                <UserPlus className="h-3 w-3" /> Thêm con
                            </button>
                        </div>

                        {/* Add child form */}
                        {showAddChild && (
                            <div className="mb-3 p-2 bg-green-50 rounded-lg space-y-2">
                                <input
                                    className="w-full border rounded px-2 py-1 text-xs bg-background"
                                    placeholder="Họ tên con..."
                                    value={newChildName}
                                    onChange={e => setNewChildName(e.target.value)}
                                />
                                <div className="flex gap-2">
                                    <select className="flex-1 border rounded px-1 py-1 text-xs bg-background" value={newChildGender} onChange={e => setNewChildGender(parseInt(e.target.value))}>
                                        <option value={1}>Nam</option>
                                        <option value={2}>Nữ</option>
                                    </select>
                                    <input type="number" className="flex-1 border rounded px-2 py-1 text-xs bg-background" placeholder="Năm sinh" value={newChildBirthYear} onChange={e => setNewChildBirthYear(e.target.value)} />
                                </div>
                                <div className="flex gap-1">
                                    <button className="flex-1 text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700" onClick={handleAddChild} disabled={!newChildName.trim()}>
                                        Thêm
                                    </button>
                                    <button className="text-xs px-2 py-1 rounded border hover:bg-muted" onClick={() => setShowAddChild(false)}>Hủy</button>
                                </div>
                            </div>
                        )}

                        {children.length > 0 && (
                            <div className="space-y-1">
                                {children.map((child, idx) => (
                                    <div key={child.id} className="flex items-center gap-1 group">
                                        <GripVertical className="h-3 w-3 text-muted-foreground/40" />
                                        <span className={`text-xs mr-0.5 ${child.gender === 1 ? 'text-blue-500' : 'text-pink-500'}`}>{child.gender === 1 ? '♂' : '♀'}</span>
                                        <span className="flex-1 text-xs truncate">{child.displayName}</span>
                                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {idx > 0 && (
                                                <button className="p-0.5 rounded hover:bg-muted" title="Lên"
                                                    onClick={() => {
                                                        const newOrder = [...parentFamily!.childIds];
                                                        [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
                                                        onReorderChildren(parentFamily!.id, newOrder);
                                                    }}>
                                                    <ArrowUp className="h-3 w-3" />
                                                </button>
                                            )}
                                            {idx < children.length - 1 && (
                                                <button className="p-0.5 rounded hover:bg-muted" title="Xuống"
                                                    onClick={() => {
                                                        const newOrder = [...parentFamily!.childIds];
                                                        [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
                                                        onReorderChildren(parentFamily!.id, newOrder);
                                                    }}>
                                                    <ArrowDown className="h-3 w-3" />
                                                </button>
                                            )}
                                            <button className="p-0.5 rounded hover:bg-red-100 text-red-500" title="Xóa liên kết"
                                                onClick={() => {
                                                    if (confirm(`Xóa "${child.displayName}" khỏi danh sách con?`)) {
                                                        onRemoveChild(child.id, parentFamily!.id);
                                                    }
                                                }}>
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Add spouse */}
                    {!parentFamily && (
                        <div className="p-3 border-b">
                            <button
                                className="w-full text-xs px-2 py-1.5 rounded border border-pink-200 text-pink-600 hover:bg-pink-50 flex items-center justify-center gap-1"
                                onClick={() => setShowAddSpouse(!showAddSpouse)}
                            >
                                <UserPlus className="h-3 w-3" /> Thêm vợ/chồng
                            </button>
                            {showAddSpouse && (
                                <div className="mt-2 p-2 bg-pink-50 rounded-lg space-y-2">
                                    <input className="w-full border rounded px-2 py-1 text-xs bg-background" placeholder="Họ tên vợ/chồng..." value={newSpouseName} onChange={e => setNewSpouseName(e.target.value)} />
                                    <input type="number" className="w-full border rounded px-2 py-1 text-xs bg-background" placeholder="Năm sinh" value={newSpouseBirthYear} onChange={e => setNewSpouseBirthYear(e.target.value)} />
                                    <div className="flex gap-1">
                                        <button className="flex-1 text-xs px-2 py-1 rounded bg-pink-600 text-white hover:bg-pink-700" onClick={handleAddSpouse} disabled={!newSpouseName.trim()}>Thêm</button>
                                        <button className="text-xs px-2 py-1 rounded border hover:bg-muted" onClick={() => setShowAddSpouse(false)}>Hủy</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Change parent — searchable */}
                    {childOfFamily && (
                        <div className="p-3 border-b" ref={parentSearchRef}>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                Đổi cha
                            </p>
                            <p className="text-xs text-muted-foreground mb-1">
                                Hiện tại: <span className="font-medium text-foreground">{parentPerson?.displayName ?? childOfFamily.id}</span>
                            </p>
                            <div className="relative">
                                <input
                                    type="text"
                                    className="w-full border rounded px-2 py-1 text-xs bg-background placeholder:text-muted-foreground/60"
                                    placeholder="Tìm cha mới..."
                                    value={parentSearch}
                                    onChange={e => { setParentSearch(e.target.value); setShowParentDropdown(true); }}
                                    onFocus={() => setShowParentDropdown(true)}
                                />
                                {showParentDropdown && (
                                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border rounded shadow-lg max-h-48 overflow-y-auto">
                                        {filteredParentFamilies.length === 0 ? (
                                            <div className="px-2 py-2 text-xs text-muted-foreground text-center">Không tìm thấy</div>
                                        ) : (
                                            filteredParentFamilies.map(f => {
                                                const isSelected = f.id === childOfFamily.id;
                                                return (
                                                    <button key={f.id}
                                                        className={`w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 flex items-center gap-1 transition-colors ${isSelected ? 'bg-blue-100 font-semibold text-blue-700' : ''}`}
                                                        onClick={() => {
                                                            if (f.id !== childOfFamily.id) onMoveChild(person.id, childOfFamily.id, f.id);
                                                            setShowParentDropdown(false);
                                                            setParentSearch('');
                                                        }}>
                                                        <span className="truncate flex-1">{f.label}</span>
                                                        <span className="text-muted-foreground/60 shrink-0">Đ{f.gen}</span>
                                                        {isSelected && <span className="text-blue-600 shrink-0">✓</span>}
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// === Kinship Overlay: banner + result panel ===
function KinshipOverlay({ selected, result, people, onSwap, onDeselect, onClose }: {
    selected: string[];
    result: KinshipResult | null;
    people: TreeNode[];
    onSwap: () => void;
    onDeselect: (handle: string) => void;
    onClose: () => void;
}) {
    const personA = selected[0] ? people.find(p => p.id === selected[0]) : null;
    const personB = selected[1] ? people.find(p => p.id === selected[1]) : null;

    return (
        <>
            {/* Top banner — kinship mode indicator */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-top-2 duration-200 max-w-[calc(100vw-1rem)]">
                <div className="bg-emerald-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-lg flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium">
                    <ArrowLeftRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    {selected.length === 0 && <span className="truncate">Xưng hô — Nhấn chọn 2 người</span>}
                    {selected.length === 1 && (
                        <span className="truncate">
                            <strong>{personA?.displayName}</strong>
                            <button onClick={() => onDeselect(selected[0])} className="ml-1 underline text-emerald-200 hover:text-white">✕</button>
                            {' → Chọn thêm 1'}
                        </span>
                    )}
                    {selected.length === 2 && result && (
                        <span className="truncate">{personA?.displayName} ↔ {personB?.displayName}</span>
                    )}
                    <button onClick={onClose} className="ml-1 sm:ml-2 p-0.5 rounded-full hover:bg-emerald-500 transition-colors shrink-0">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Result panel — centered, responsive */}
            {result && personA && personB && (
                <div className="absolute inset-0 z-40 flex items-end sm:items-center justify-center pointer-events-none animate-in fade-in duration-300 p-2 sm:p-4">
                    <div className="pointer-events-auto w-full sm:w-[420px] md:w-[480px] max-w-[calc(100vw-1rem)] max-h-[calc(100vh-4rem)] overflow-y-auto overscroll-y-contain touch-pan-y rounded-xl">
                        <Card className="border-2 border-emerald-200 shadow-2xl bg-white/95 backdrop-blur-lg">
                            <CardContent className="p-3 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
                                {/* Relationship title */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                        <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" />
                                        <span className="font-bold text-emerald-700 text-sm sm:text-base truncate">{result.relationship}</span>
                                    </div>
                                    <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                                        <button onClick={onSwap} className="p-1 sm:p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600" title="Đổi chỗ">
                                            <ArrowLeftRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                        </button>
                                        <button onClick={onClose} className="p-1 sm:p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                                            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Addressing cards */}
                                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                    <div className="bg-blue-50 rounded-lg sm:rounded-xl p-2.5 sm:p-4 text-center space-y-1">
                                        <div className="text-[10px] sm:text-xs text-slate-500">
                                            <span className="font-semibold text-slate-700">{personA.displayName}</span> gọi
                                        </div>
                                        <div className="text-[10px] sm:text-xs text-slate-500">
                                            <span className="font-semibold text-slate-700">{personB.displayName}</span> là
                                        </div>
                                        <div className="text-lg sm:text-2xl font-bold text-blue-600">
                                            {result.aCallsB}
                                        </div>
                                    </div>
                                    <div className="bg-pink-50 rounded-lg sm:rounded-xl p-2.5 sm:p-4 text-center space-y-1">
                                        <div className="text-[10px] sm:text-xs text-slate-500">
                                            <span className="font-semibold text-slate-700">{personB.displayName}</span> gọi
                                        </div>
                                        <div className="text-[10px] sm:text-xs text-slate-500">
                                            <span className="font-semibold text-slate-700">{personA.displayName}</span> là
                                        </div>
                                        <div className="text-lg sm:text-2xl font-bold text-pink-600">
                                            {result.bCallsA}
                                        </div>
                                    </div>
                                </div>

                                {/* Generation gap */}
                                {result.generationGap !== 0 && (
                                    <div className="text-center text-[10px] sm:text-xs text-slate-500">
                                        Cách nhau <strong className="text-slate-700">{Math.abs(result.generationGap)}</strong> đời
                                    </div>
                                )}

                                {/* Path visualization */}
                                {result.path.length > 1 && (
                                    <div>
                                        <p className="text-[10px] sm:text-xs font-semibold text-slate-400 mb-1.5 sm:mb-2">Đường đi trong gia phả</p>
                                        <div className="flex flex-wrap items-center gap-0.5 sm:gap-1">
                                            {result.path.map((step, i) => (
                                                <div key={step.personId} className="flex items-center gap-0.5 sm:gap-1">
                                                    <span
                                                        className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-medium border
                                                            ${i === 0 ? 'bg-blue-100 border-blue-300 text-blue-700' :
                                                            i === result.path.length - 1 ? 'bg-pink-100 border-pink-300 text-pink-700' :
                                                            'bg-slate-50 border-slate-200 text-slate-600'}`}
                                                    >
                                                        <span className={`mr-0.5 ${step.gender === 1 ? 'text-blue-500' : 'text-pink-500'}`}>
                                                            {step.gender === 1 ? '♂' : '♀'}
                                                        </span>
                                                        {step.personName}
                                                    </span>
                                                    {i < result.path.length - 1 && (
                                                        <span className="text-[10px] sm:text-xs text-slate-400">
                                                            {result.path[i + 1].edgeType === 'parent' ? '↑' :
                                                                result.path[i + 1].edgeType === 'child' ? '↓' : '♥'}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Hint to change selection */}
                                <p className="text-[10px] sm:text-xs text-slate-400 text-center">
                                    Nhấn vào người khác trên phả đồ để thay đổi
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {/* No result found — centered */}
            {selected.length === 2 && !result && (
                <div className="absolute inset-0 z-40 flex items-end sm:items-center justify-center pointer-events-none animate-in fade-in duration-300 p-2 sm:p-4">
                    <div className="pointer-events-auto w-full sm:w-[420px] max-w-[calc(100vw-1rem)]">
                        <Card className="border-2 border-orange-200 shadow-2xl bg-white/95 backdrop-blur-lg">
                            <CardContent className="p-4 sm:p-6 text-center space-y-2">
                                <p className="text-xs sm:text-sm text-muted-foreground">Không tìm thấy mối quan hệ giữa hai người này.</p>
                                <p className="text-[10px] sm:text-xs text-muted-foreground">Có thể họ thuộc các nhánh không liên kết.</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </>
    );
}
