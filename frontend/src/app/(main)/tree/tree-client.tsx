'use client';

import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { ContributeDialog } from '@/components/contribute-dialog';
import { Search, ZoomIn, ZoomOut, Maximize2, TreePine, Eye, Users, GitBranch, User, ArrowDownToLine, ArrowUpFromLine, Crosshair, X, ChevronDown, ChevronRight, BarChart3, Package, Link, ChevronsDownUp, ChevronsUpDown, Copy, Pencil, Save, RotateCcw, Trash2, ArrowUp, ArrowDown, GripVertical, MessageSquarePlus, UserPlus, Phone, Mail, MapPin, Briefcase, GraduationCap, StickyNote, Heart, Baby, GripHorizontal } from 'lucide-react';
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
    parentHandle: string;
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
    const personMap = new Map(people.map(p => [p.handle, p]));
    const familyMap = new Map(families.map(f => [f.handle, f]));
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
            for (const ch of fam.children) walk(ch);
        }
    }

    // Walk from this person's children (not including the person itself)
    for (const fId of (parentFamiliesMap.get(handle) || [])) {
        const fam = familyMap.get(fId);
        if (!fam) continue;
        // Also count spouse
        if (fam.motherHandle && fam.motherHandle !== handle && !visited.has(fam.motherHandle)) {
            const spouse = personMap.get(fam.motherHandle);
            if (spouse) { visited.add(fam.motherHandle); if (spouse.isLiving) livingCount++; else deceasedCount++; }
        }
        if (fam.fatherHandle && fam.fatherHandle !== handle && !visited.has(fam.fatherHandle)) {
            const spouse = personMap.get(fam.fatherHandle);
            if (spouse) { visited.add(fam.fatherHandle); if (spouse.isLiving) livingCount++; else deceasedCount++; }
        }
        for (const ch of fam.children) walk(ch);
    }

    return {
        parentHandle: handle,
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
    for (const f of families) for (const ch of f.children) childOf.add(ch);
    const roots = people.filter(p => p.isPatrilineal && !childOf.has(p.handle));
    const gens = new Map<string, number>();
    const familyMap = new Map(families.map(f => [f.handle, f]));
    const queue: { handle: string; gen: number }[] = roots.map(r => ({ handle: r.handle, gen: 0 }));
    while (queue.length > 0) {
        const { handle, gen } = queue.shift()!;
        if (gens.has(handle)) continue;
        gens.set(handle, gen);
        const person = people.find(p => p.handle === handle);
        if (!person) continue;
        for (const fId of person.families) {
            const fam = familyMap.get(fId);
            if (!fam) continue;
            // Spouse at same gen
            if (fam.fatherHandle && !gens.has(fam.fatherHandle)) gens.set(fam.fatherHandle, gen);
            if (fam.motherHandle && !gens.has(fam.motherHandle)) gens.set(fam.motherHandle, gen);
            for (const ch of fam.children) {
                if (!gens.has(ch)) queue.push({ handle: ch, gen: gen + 1 });
            }
        }
    }
    return gens;
}

export default function TreeViewPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const containerRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);

    const [treeData, setTreeData] = useState<{ people: TreeNode[]; families: TreeFamily[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('full');
    const [focusPerson, setFocusPerson] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [highlightHandles, setHighlightHandles] = useState<Set<string>>(new Set());
    const [hoveredHandle, setHoveredHandle] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<{ handle: string; x: number; y: number } | null>(null);
    const [contributePerson, setContributePerson] = useState<{ handle: string; name: string } | null>(null);
    const [linkCopied, setLinkCopied] = useState(false);
    const [detailPerson, setDetailPerson] = useState<string | null>(null);

    // F4: Collapsible branches
    const [collapsedBranches, setCollapsedBranches] = useState<Set<string>>(new Set());
    // F3: Stats panel user-hidden
    const [statsHidden, setStatsHidden] = useState(false);

    // Editor mode state
    const [editorMode, setEditorMode] = useState(false);
    const [selectedCard, setSelectedCard] = useState<string | null>(null);
    const { isAdmin, canEdit } = useAuth();

    // Quick add person from context menu
    const [quickAdd, setQuickAdd] = useState<{ person: TreeNode; x: number; y: number } | null>(null);

    // Drag-and-drop state (editor mode only)
    const [dragState, setDragState] = useState<{
        handle: string;
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
    } | null>(null);
    const [dropTarget, setDropTarget] = useState<string | null>(null);

    // URL query param initialization + auto-collapse on initial load
    const urlInitialized = useRef(false);
    const initialFocusFromUrl = useRef<string | null>(null);
    useEffect(() => {
        if (urlInitialized.current || !treeData) return;
        urlInitialized.current = true;
        const viewParam = searchParams.get('view') as ViewMode | null;
        const personParam = searchParams.get('person') || searchParams.get('focus');
        // Store initial focus for centering effect (before URL sync strips it)
        initialFocusFromUrl.current = personParam;
        if (viewParam && ['full', 'ancestor', 'descendant'].includes(viewParam)) {
            setViewMode(viewParam);
        }
        if (personParam && treeData.people.some(p => p.handle === personParam)) {
            setFocusPerson(personParam);
        }
        // Auto-collapse on initial load
        if (!viewParam || viewParam === 'full') {
            // Panoramic: collapse by absolute generation
            const gens = computePersonGenerations(treeData.people, treeData.families);
            const toCollapse = new Set<string>();
            for (const f of treeData.families) {
                if (f.children.length === 0) continue;
                const parentHandle = f.fatherHandle || f.motherHandle;
                if (!parentHandle) continue;
                const gen = gens.get(parentHandle);
                if (gen !== undefined && gen >= AUTO_COLLAPSE_GEN) {
                    toCollapse.add(parentHandle);
                }
            }
            setCollapsedBranches(toCollapse);
        } else if (viewParam === 'descendant' && personParam) {
            // Descendant: collapse by relative depth from focus person
            const personMap = new Map(treeData.people.map(p => [p.handle, p]));
            const toCollapse = new Set<string>();
            const depthMap = new Map<string, number>();
            const queue: string[] = [personParam];
            depthMap.set(personParam, 0);
            while (queue.length > 0) {
                const h = queue.shift()!;
                const depth = depthMap.get(h)!;
                const p = personMap.get(h);
                if (!p) continue;
                for (const fId of p.families) {
                    const fam = treeData.families.find(f => f.handle === fId);
                    if (!fam || fam.children.length === 0) continue;
                    if (depth >= AUTO_COLLAPSE_GEN) {
                        toCollapse.add(h);
                    } else {
                        for (const ch of fam.children) {
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
        router.replace(`/tree${qs ? '?' + qs : ''}`, { scroll: false });
    }, [viewMode, focusPerson, router]);

    // Transform state
    const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef({ startX: 0, startY: 0, startTx: 0, startTy: 0 });
    const pinchRef = useRef({ initialDist: 0, initialScale: 1 });

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
    const zoomLevel = useMemo<ZoomLevel>(() => getZoomLevel(transform.scale), [transform.scale]);

    // F4: Get all descendants of collapsed branches
    const getDescendantHandles = useCallback((handle: string): Set<string> => {
        if (!treeData) return new Set();
        const familyMap = new Map(treeData.families.map(f => [f.handle, f]));
        const parentFamiliesMap = buildParentToFamiliesMap(treeData.families);
        const result = new Set<string>();
        function walk(h: string) {
            for (const fId of (parentFamiliesMap.get(h) || [])) {
                const fam = familyMap.get(fId);
                if (!fam) continue;
                // Include spouse
                if (fam.motherHandle && fam.motherHandle !== h) result.add(fam.motherHandle);
                if (fam.fatherHandle && fam.fatherHandle !== h) result.add(fam.fatherHandle);
                for (const ch of fam.children) {
                    result.add(ch);
                    walk(ch);
                }
            }
        }
        walk(handle);
        return result;
    }, [treeData]);

    // F4: Compute all hidden handles from collapsed branches
    const hiddenHandles = useMemo(() => {
        if (!treeData) return new Set<string>();
        const hidden = new Set<string>();
        for (const h of collapsedBranches) {
            const descendants = getDescendantHandles(h);
            for (const d of descendants) hidden.add(d);
        }
        // Collapsed persons must stay visible to show their summary card.
        // (getDescendantHandles includes spouses, so when both parents are collapsed,
        // each marks the other as a "descendant" → both get hidden. Fix: un-hide them.)
        for (const h of collapsedBranches) {
            hidden.delete(h);
        }
        // Cascade: hide people whose ALL parent families have hidden fathers
        // This catches nodes that leaked through (e.g., gen 13 whose gen 12 parents are hidden)
        const familyMap = new Map(treeData.families.map(f => [f.handle, f]));
        let changed = true;
        while (changed) {
            changed = false;
            for (const p of treeData.people) {
                if (hidden.has(p.handle)) continue;
                if (collapsedBranches.has(p.handle)) continue; // collapsed persons stay visible
                if (p.parentFamilies.length === 0) continue;
                // Check if ALL parent families have their father/mother hidden
                const allParentsHidden = p.parentFamilies.every(pfId => {
                    const pf = familyMap.get(pfId);
                    if (!pf) return true; // orphan family = treat as hidden
                    const fatherHidden = pf.fatherHandle ? hidden.has(pf.fatherHandle) : true;
                    const motherHidden = pf.motherHandle ? hidden.has(pf.motherHandle) : true;
                    return fatherHidden && motherHidden;
                });
                if (allParentsHidden) {
                    hidden.add(p.handle);
                    changed = true;
                }
            }
        }
        return hidden;
    }, [collapsedBranches, getDescendantHandles, treeData]);

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
        const familyMap = new Map(treeData.families.map(f => [f.handle, f]));
        setCollapsedBranches(prev => {
            const next = new Set(prev);
            if (next.has(handle)) {
                // Expanding: remove this person's collapse, but auto-collapse their
                // direct children who have descendants (progressive reveal)
                next.delete(handle);
                for (const fId of (parentFamiliesMap.get(handle) || [])) {
                    const fam = familyMap.get(fId);
                    if (!fam) continue;
                    for (const ch of fam.children) {
                        // Check if child has their own children (using families table)
                        const childHasChildren = (parentFamiliesMap.get(ch) || []).some(cfId => {
                            const cf = familyMap.get(cfId);
                            return cf && cf.children.length > 0;
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
            if (f.children.length > 0) {
                if (f.fatherHandle) allParents.add(f.fatherHandle);
                if (f.motherHandle) allParents.add(f.motherHandle);
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
            if (f.children.length === 0) continue;
            const parentHandle = f.fatherHandle || f.motherHandle;
            if (!parentHandle) continue;
            const gen = gens.get(parentHandle);
            if (gen !== undefined && gen >= AUTO_COLLAPSE_GEN) {
                toCollapse.add(parentHandle);
            }
        }
        setCollapsedBranches(toCollapse);
    }, [treeData]);

    // Auto-collapse for Hậu duệ view: collapse branches beyond AUTO_COLLAPSE_GEN relative depth from focus
    const autoCollapseForDescendant = useCallback((person: string) => {
        if (!treeData) return;
        const parentFamiliesMap = buildParentToFamiliesMap(treeData.families);
        const familyMap = new Map(treeData.families.map(f => [f.handle, f]));
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
                if (!fam || fam.children.length === 0) continue;
                if (depth >= AUTO_COLLAPSE_GEN) {
                    toCollapse.add(h);
                } else {
                    for (const ch of fam.children) {
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
        const visiblePeople = d.people.filter((p: TreeNode) => !hiddenHandles.has(p.handle));
        const visibleFamilies = d.families.filter((f: TreeFamily) => {
            // Keep family only if NOT all parents are hidden
            const fatherHidden = f.fatherHandle ? hiddenHandles.has(f.fatherHandle) : true;
            const motherHidden = f.motherHandle ? hiddenHandles.has(f.motherHandle) : true;
            return !(fatherHidden && motherHidden);
        });
        return computeLayout(visiblePeople, visibleFamilies);
    }, [displayData, hiddenHandles]);

    // F4: Check if a person has children (for showing toggle button)
    const hasChildren = useCallback((handle: string): boolean => {
        if (!treeData) return false;
        return treeData.families.some(f =>
            (f.fatherHandle === handle || f.motherHandle === handle) && f.children.length > 0
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
        if (!layout || !viewportRef.current) return layout?.nodes ?? [];
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
    }, [layout, transform]);

    const visibleHandles = useMemo(() => new Set(visibleNodes.map(n => n.node.handle)), [visibleNodes]);

    // Batched SVG paths for connections
    const { parentPaths, couplePaths, visibleCouples } = useMemo(() => {
        if (!layout) return { parentPaths: '', couplePaths: '', visibleCouples: [] as PositionedCouple[] };
        let pp = '';
        let cp = '';
        const vc: PositionedCouple[] = [];
        // Only render connections where the line segment intersects visible area
        const vw = viewportRef.current?.clientWidth ?? 1200;
        const vh = viewportRef.current?.clientHeight ?? 900;
        const { x: tx, y: ty, scale } = transform;
        const left = (-tx / scale) - CULL_PAD;
        const top = (-ty / scale) - CULL_PAD;
        const right = ((vw - tx) / scale) + CULL_PAD;
        const bottom = ((vh - ty) / scale) + CULL_PAD;
        for (const c of layout.connections) {
            // Check if the line segment's bounding box intersects the viewport
            const minX = Math.min(c.fromX, c.toX);
            const maxX = Math.max(c.fromX, c.toX);
            const minY = Math.min(c.fromY, c.toY);
            const maxY = Math.max(c.fromY, c.toY);
            if (maxX < left || minX > right || maxY < top || minY > bottom) continue;

            if (c.type === 'couple') {
                cp += `M${c.fromX},${c.fromY}L${c.toX},${c.toY}`;
            } else {
                // Each connection segment is already a single straight line
                // (either horizontal or vertical) from the layout engine
                pp += `M${c.fromX},${c.fromY}L${c.toX},${c.toY}`;
            }
        }
        // Visible couples for hearts
        for (const c of layout.couples) {
            if (visibleHandles.has(c.fatherPos?.node.handle ?? '') || visibleHandles.has(c.motherPos?.node.handle ?? '')) {
                vc.push(c);
            }
        }
        return { parentPaths: pp, couplePaths: cp, visibleCouples: vc };
    }, [layout, transform, visibleHandles]);

    // Stable callbacks for PersonCard
    const handleCardHover = useCallback((h: string | null) => setHoveredHandle(h), []);
    const handleCardClick = useCallback((handle: string, x: number, y: number) => {
        if (editorMode) {
            setSelectedCard(handle);
            return;
        }
        setContextMenu({ handle, x, y });
    }, [editorMode]);
    const handleCardFocus = useCallback((handle: string) => {
        setFocusPerson(handle);
    }, []);

    // === Handle generators (shared between EditorPanel and QuickAddDialog) ===
    // Handle format: Dxx-yyy (patrilineal child), S_Dxx-yyy (spouse)
    const nextChildHandle = useCallback((generation: number) => {
        if (!treeData) return `D${String(generation).padStart(2, '0')}-001`;
        const genStr = String(generation).padStart(2, '0');
        const prefix = `D${genStr}-`;
        const maxIdx = treeData.people
            .filter(p => p.handle.startsWith(prefix))
            .reduce((max, p) => {
                const idx = parseInt(p.handle.replace(prefix, '')) || 0;
                return Math.max(max, idx);
            }, 0);
        return `${prefix}${String(maxIdx + 1).padStart(3, '0')}`;
    }, [treeData]);

    const nextSpouseHandle = useCallback((contextPersonHandle: string) => {
        return `S_${contextPersonHandle}`;
    }, []);

    // Legacy nextHandle for EditorPanel compatibility (generates Dxx-yyy for given gen)
    const nextHandle = useCallback((generation?: number) => {
        const gen = generation ?? 1;
        return nextChildHandle(gen);
    }, [nextChildHandle]);

    const nextFamilyHandle = useCallback(() => {
        if (!treeData) return 'F001';
        const maxNum = treeData.families.reduce((max, f) => {
            const num = parseInt(f.handle.replace(/\D/g, '')) || 0;
            return Math.max(max, num);
        }, 0);
        return `F${String(maxNum + 1).padStart(3, '0')}`;
    }, [treeData]);

    // === Quick add person handler (from context menu) ===
    const handleQuickAddPerson = useCallback(async (newPerson: {
        handle: string; displayName: string; gender: number; generation: number;
        birthYear?: number; parentFamilyHandle?: string;
        // Extended fields
        nickName?: string; birthDate?: string; phone?: string;
        currentAddress?: string; education?: string; occupation?: string;
        notes?: string; title?: string; birthOrder?: number;
        maritalStatus?: string; bloodType?: string; isLiving?: boolean;
    }, contextPerson: TreeNode) => {
        if (!treeData) return;
        const treeNode: TreeNode = {
            handle: newPerson.handle,
            displayName: newPerson.displayName,
            gender: newPerson.gender,
            generation: newPerson.generation,
            birthYear: newPerson.birthYear,
            isLiving: newPerson.isLiving ?? true,
            isPrivacyFiltered: false,
            isPatrilineal: newPerson.gender === 1,
            families: [],
            parentFamilies: newPerson.parentFamilyHandle ? [newPerson.parentFamilyHandle] : [],
        };

        setTreeData(prev => {
            if (!prev) return null;
            let newPeople = [...prev.people, treeNode];
            let newFamilies = [...prev.families];

            if (newPerson.parentFamilyHandle) {
                const existingFamily = newFamilies.find(f => f.handle === newPerson.parentFamilyHandle);
                if (existingFamily) {
                    if (newPerson.generation === contextPerson.generation) {
                        // Adding spouse
                        if (newPerson.gender === 2 && !existingFamily.motherHandle) {
                            newFamilies = newFamilies.map(f => f.handle === newPerson.parentFamilyHandle ? { ...f, motherHandle: newPerson.handle } : f);
                            treeNode.families = [newPerson.parentFamilyHandle!];
                            treeNode.parentFamilies = [];
                            treeNode.isPatrilineal = false;
                        } else if (newPerson.gender === 1 && !existingFamily.fatherHandle) {
                            newFamilies = newFamilies.map(f => f.handle === newPerson.parentFamilyHandle ? { ...f, fatherHandle: newPerson.handle } : f);
                            treeNode.families = [newPerson.parentFamilyHandle!];
                            treeNode.parentFamilies = [];
                            treeNode.isPatrilineal = false;
                        }
                    } else {
                        // Adding child
                        newFamilies = newFamilies.map(f =>
                            f.handle === newPerson.parentFamilyHandle
                                ? { ...f, children: [...f.children, newPerson.handle] }
                                : f
                        );
                    }
                } else {
                    // Create new family
                    if (newPerson.generation === contextPerson.generation) {
                        // Spouse — new family
                        const newFamily: TreeFamily = {
                            handle: newPerson.parentFamilyHandle,
                            fatherHandle: contextPerson.gender === 1 ? contextPerson.handle : newPerson.handle,
                            motherHandle: contextPerson.gender === 2 ? contextPerson.handle : newPerson.handle,
                            children: [],
                        };
                        newFamilies.push(newFamily);
                        // Immutable update: create new object for contextPerson
                        newPeople = newPeople.map(p =>
                            p.handle === contextPerson.handle
                                ? { ...p, families: [...(p.families || []), newPerson.parentFamilyHandle!] }
                                : p
                        );
                        treeNode.families = [newPerson.parentFamilyHandle!];
                        treeNode.parentFamilies = [];
                        treeNode.isPatrilineal = false;
                    } else {
                        // Child — new family
                        const newFamily: TreeFamily = {
                            handle: newPerson.parentFamilyHandle,
                            fatherHandle: contextPerson.gender === 1 ? contextPerson.handle : undefined,
                            motherHandle: contextPerson.gender === 2 ? contextPerson.handle : undefined,
                            children: [newPerson.handle],
                        };
                        newFamilies.push(newFamily);
                        // Immutable update: create new object for contextPerson
                        newPeople = newPeople.map(p =>
                            p.handle === contextPerson.handle
                                ? { ...p, families: [...(p.families || []), newPerson.parentFamilyHandle!] }
                                : p
                        );
                    }
                }
            }

            return { people: newPeople, families: newFamilies };
        });

        // Persist to Supabase (with all extended fields)
        await supaAddPerson({
            handle: treeNode.handle,
            displayName: treeNode.displayName,
            gender: treeNode.gender,
            generation: treeNode.generation,
            birthYear: treeNode.birthYear,
            isLiving: newPerson.isLiving ?? true,
            families: treeNode.families,
            parentFamilies: treeNode.parentFamilies,
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
        if (newPerson.parentFamilyHandle) {
            const existingFamily = treeData.families.find(f => f.handle === newPerson.parentFamilyHandle);
            if (!existingFamily) {
                if (newPerson.generation === contextPerson.generation) {
                    await supaAddFamily({
                        handle: newPerson.parentFamilyHandle,
                        fatherHandle: contextPerson.gender === 1 ? contextPerson.handle : newPerson.handle,
                        motherHandle: contextPerson.gender === 2 ? contextPerson.handle : newPerson.handle,
                        children: [],
                    });
                } else {
                    await supaAddFamily({
                        handle: newPerson.parentFamilyHandle,
                        fatherHandle: contextPerson.gender === 1 ? contextPerson.handle : undefined,
                        motherHandle: contextPerson.gender === 2 ? contextPerson.handle : undefined,
                        children: [newPerson.handle],
                    });
                }
                // Persist parent's updated families to Supabase (fixes collapse bug after reload)
                await supaUpdatePersonFamilies(
                    contextPerson.handle,
                    [...(contextPerson.families || []), newPerson.parentFamilyHandle],
                );
            } else {
                if (newPerson.generation !== contextPerson.generation) {
                    await supaUpdateFamilyChildren(newPerson.parentFamilyHandle, [...existingFamily.children, newPerson.handle]);
                }
            }
        }
    }, [treeData]);

    // === Drag-and-drop handlers (editor mode) ===
    const handleCardDragStart = useCallback((handle: string, clientX: number, clientY: number) => {
        if (!editorMode) return;
        setDragState({ handle, startX: clientX, startY: clientY, currentX: clientX, currentY: clientY });
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
            if (n.node.handle === dragState.handle) continue;
            if (mx >= n.x && mx <= n.x + CARD_W && my >= n.y && my <= n.y + CARD_H) {
                found = n.node.handle;
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
        const draggedPerson = treeData.people.find(p => p.handle === dragState.handle);
        const targetPerson = treeData.people.find(p => p.handle === dropTarget);
        if (!draggedPerson || !targetPerson) {
            setDragState(null);
            setDropTarget(null);
            return;
        }

        // Find family where dragged person is a child
        const fromFamily = treeData.families.find(f => f.children.includes(dragState.handle));
        if (!fromFamily) {
            setDragState(null);
            setDropTarget(null);
            return;
        }

        // Find or create family where target person is a parent
        let toFamily = treeData.families.find(f =>
            f.fatherHandle === dropTarget || f.motherHandle === dropTarget
        );

        if (toFamily && toFamily.handle !== fromFamily.handle) {
            // Move child from one family to another
            setTreeData(prev => {
                if (!prev) return null;
                const families = prev.families.map(f => {
                    if (f.handle === fromFamily.handle) return { ...f, children: f.children.filter(c => c !== dragState.handle) };
                    if (f.handle === toFamily!.handle) return { ...f, children: [...f.children, dragState.handle] };
                    return f;
                });
                supaMoveChild(dragState.handle, fromFamily.handle, toFamily!.handle, prev.families);
                return { ...prev, families };
            });
        }

        setDragState(null);
        setDropTarget(null);
    }, [dragState, dropTarget, treeData]);

    // Search highlight
    useEffect(() => {
        if (!searchQuery || !treeData) { setHighlightHandles(new Set()); return; }
        const q = searchQuery.toLowerCase();
        setHighlightHandles(new Set(treeData.people.filter(p => p.displayName.toLowerCase().includes(q)).map(p => p.handle)));
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

    // Center on root ancestor at readable zoom on first load
    const initialFitDone = useRef(false);
    useEffect(() => {
        if (!layout || loading) return;
        if (initialFitDone.current) return;
        initialFitDone.current = true;
        setTimeout(() => {
            if (!viewportRef.current) return;
            const vw = viewportRef.current.clientWidth;
            const vh = viewportRef.current.clientHeight;
            // If a specific person was requested via URL (?focus= or ?person=), center on them
            const urlFocus = initialFocusFromUrl.current;
            const focusNode = urlFocus ? layout.nodes.find(n => n.node.handle === urlFocus) : null;
            if (focusNode) {
                const targetScale = 0.8;
                setTransform({
                    x: vw / 2 - (focusNode.x + CARD_W / 2) * targetScale,
                    y: vh * 0.3 - focusNode.y * targetScale,
                    scale: targetScale,
                });
                return;
            }
            // Default: center on cụ Khoan Giản (the branch root) or the earliest patrilineal ancestor
            const khoanGian = layout.nodes.find(n => n.node.handle === 'D10-003');
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
    }, [layout, loading, fitAll]);

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

    // === Touch handlers ===
    useEffect(() => {
        const el = viewportRef.current;
        if (!el) return;

        let touching = false;
        let lastTouches: Touch[] = [];

        const onTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 1) {
                touching = true;
                const t = e.touches[0];
                dragRef.current = { startX: t.clientX, startY: t.clientY, startTx: transform.x, startTy: transform.y };
            } else if (e.touches.length === 2) {
                const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
                pinchRef.current = { initialDist: dist, initialScale: transform.scale };
            }
            lastTouches = Array.from(e.touches);
        };

        const onTouchMove = (e: TouchEvent) => {
            e.preventDefault();
            if (e.touches.length === 1 && touching) {
                const t = e.touches[0];
                const dx = t.clientX - dragRef.current.startX;
                const dy = t.clientY - dragRef.current.startY;
                setTransform(prev => ({ ...prev, x: dragRef.current.startTx + dx, y: dragRef.current.startTy + dy }));
            } else if (e.touches.length === 2) {
                const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
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
            lastTouches = Array.from(e.touches);
        };

        const onTouchEnd = () => { touching = false; };

        el.addEventListener('touchstart', onTouchStart, { passive: false });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd);
        return () => {
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
        };
    }, [transform.x, transform.y, transform.scale]);

    // Pan to person
    const panToPerson = useCallback((handle: string) => {
        if (!layout || !viewportRef.current) return;
        const node = layout.nodes.find(n => n.node.handle === handle);
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

    // View mode
    const changeViewMode = (mode: ViewMode) => {
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
                const patrilineals = treeData.people.filter(p => p.isPatrilineal);
                const latestPatrilineal = patrilineals.sort((a, b) => b.generation - a.generation)[0];
                const person = latestPatrilineal?.handle || focusPerson || treeData.people[0]?.handle || null;
                if (person) {
                    setFocusPerson(person);
                    setViewMode('ancestor');
                    // Auto-collapse: collapse all ancestors so only Đời 1 is visible initially
                    // User expands one generation at a time to explore the lineage
                    const { filteredPeople } = filterAncestors(person, treeData.people, treeData.families);
                    const toCollapse = new Set<string>();
                    for (const p of filteredPeople) {
                        // Collapse everyone except the focus person (last generation)
                        if (p.handle !== person) {
                            toCollapse.add(p.handle);
                        }
                    }
                    setCollapsedBranches(toCollapse);
                    pendingFitAll.current = true;
                }
            }
        } else if (mode === 'descendant') {
            if (!focusPerson && treeData?.people[0]) setFocusPerson(treeData.people[0].handle);
            setViewMode('descendant');
            const person = focusPerson || treeData?.people[0]?.handle;
            if (person) autoCollapseForDescendant(person);
            pendingFitAll.current = true;
        }
    };

    // Effect: run fitAll when layout recalculates after a view mode change
    useEffect(() => {
        if (!pendingFitAll.current || !layout) return;
        pendingFitAll.current = false;
        // Small delay to ensure DOM has updated
        setTimeout(() => fitAll(), 50);
    }, [layout, fitAll]);

    // Copy shareable link
    const copyTreeLink = useCallback((handle: string) => {
        const url = `${window.location.origin}/tree?view=descendant&person=${handle}`;
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
                                {treeData?.people.find(p => p.handle === focusPerson)?.displayName}
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                    {/* View modes */}
                    <div className="flex rounded-lg border overflow-hidden text-xs">
                        {([['full', 'Toàn cảnh', Eye], ['ancestor', 'Tổ tiên', Users], ['descendant', 'Hậu duệ', GitBranch]] as const).map(([mode, label, Icon]) => (
                            <button key={mode} onClick={() => changeViewMode(mode)}
                                className={`px-1.5 sm:px-2.5 py-1.5 font-medium flex items-center gap-1 transition-colors ${mode !== 'full' ? 'border-l' : ''} ${viewMode === mode ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                                <Icon className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{label}</span>
                            </button>
                        ))}
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
                                        <button key={p.handle} onClick={() => {
                                            setFocusPerson(p.handle);
                                            setViewMode('descendant');
                                            autoCollapseForDescendant(p.handle);
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
                        <div className="w-px bg-border mx-0.5" />
                        {canEdit && (
                            <Button
                                variant={editorMode ? 'default' : 'outline'}
                                size="icon"
                                className={`h-8 w-8 ${editorMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                                title={editorMode ? 'Tắt chỉnh sửa' : 'Chế độ chỉnh sửa'}
                                onClick={() => { setEditorMode(m => !m); setSelectedCard(null); }}
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
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                        </div>
                    ) : layout && (
                        <div style={{
                            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
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
                                    <text key={c.familyHandle}
                                        x={c.midX} y={c.y + CARD_H / 2 + 4}
                                        textAnchor="middle" fontSize="10" fill="#e11d48">❤</text>
                                ))}
                            </svg>

                            {/* DOM nodes — only visible (culled) */}
                            {visibleNodes.map(item => (
                                <MemoPersonCard key={item.node.handle} item={item}
                                    isHighlighted={highlightHandles.has(item.node.handle)}
                                    isFocused={focusPerson === item.node.handle}
                                    isHovered={hoveredHandle === item.node.handle}
                                    isSelected={editorMode && selectedCard === item.node.handle}
                                    zoomLevel={zoomLevel}
                                    showCollapseToggle={hasChildren(item.node.handle)}
                                    isCollapsed={collapsedBranches.has(item.node.handle)}
                                    isDragging={dragState?.handle === item.node.handle}
                                    isDropTarget={dropTarget === item.node.handle}
                                    editorMode={editorMode}
                                    onHover={handleCardHover}
                                    onClick={handleCardClick}
                                    onSetFocus={handleCardFocus}
                                    onToggleCollapse={toggleCollapse}
                                    onDragStart={handleCardDragStart}
                                />
                            ))}

                            {/* F4: Branch summary cards for collapsed nodes */}
                            {Array.from(branchSummaries.entries()).map(([handle, summary]) => {
                                const parentNode = layout.nodes.find(n => n.node.handle === handle);
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
                                const draggedNode = layout?.nodes.find(n => n.node.handle === dragState.handle);
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
                        const person = treeData?.people.find(p => p.handle === contextMenu.handle);
                        if (!person) return null;
                        return (
                            <CardContextMenu
                                person={person}
                                x={contextMenu.x}
                                y={contextMenu.y}
                                canEdit={canEdit}
                                viewportRef={viewportRef}
                                transform={transform}
                                onViewDetail={() => { setDetailPerson(person.handle); setContextMenu(null); }}
                                onShowDescendants={() => { setFocusPerson(person.handle); setViewMode('descendant'); setContextMenu(null); }}
                                onShowAncestors={() => { setFocusPerson(person.handle); setViewMode('ancestor'); setContextMenu(null); }}
                                onSetFocus={() => { panToPerson(person.handle); setContextMenu(null); }}
                                onShowFull={() => { setViewMode('full'); setContextMenu(null); }}
                                onCopyLink={() => { copyTreeLink(person.handle); setContextMenu(null); }}
                                onContribute={() => { setContributePerson({ handle: person.handle, name: person.displayName }); setContextMenu(null); }}
                                onAddPerson={() => { setQuickAdd({ person, x: contextMenu.x, y: contextMenu.y }); setContextMenu(null); }}
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
                            nextChildHandle={nextChildHandle}
                            nextSpouseHandle={nextSpouseHandle}
                            nextFamilyHandle={nextFamilyHandle}
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
                                    <option key={p.handle} value={p.handle}>{p.displayName}</option>
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
                        onReorderChildren={(familyHandle, newOrder) => {
                            setTreeData(prev => prev ? {
                                ...prev,
                                families: prev.families.map(f => f.handle === familyHandle ? { ...f, children: newOrder } : f)
                            } : null);
                            supaUpdateFamilyChildren(familyHandle, newOrder);
                        }}
                        onMoveChild={(childHandle, fromFamily, toFamily) => {
                            setTreeData(prev => {
                                if (!prev) return null;
                                const families = prev.families.map(f => {
                                    if (f.handle === fromFamily) return { ...f, children: f.children.filter(c => c !== childHandle) };
                                    if (f.handle === toFamily) return { ...f, children: [...f.children, childHandle] };
                                    return f;
                                });
                                supaMoveChild(childHandle, fromFamily, toFamily, prev.families);
                                return { ...prev, families };
                            });
                        }}
                        onRemoveChild={(childHandle, familyHandle) => {
                            setTreeData(prev => {
                                if (!prev) return null;
                                const families = prev.families.map(f =>
                                    f.handle === familyHandle ? { ...f, children: f.children.filter(c => c !== childHandle) } : f
                                );
                                supaRemoveChild(childHandle, familyHandle, prev.families);
                                return { ...prev, families };
                            });
                        }}
                        onToggleLiving={(handle, isLiving) => {
                            setTreeData(prev => prev ? {
                                ...prev,
                                people: prev.people.map(p => p.handle === handle ? { ...p, isLiving } : p)
                            } : null);
                            supaUpdatePersonLiving(handle, isLiving);
                        }}
                        onUpdatePerson={(handle, fields) => {
                            setTreeData(prev => {
                                if (!prev) return null;
                                return {
                                    ...prev,
                                    people: prev.people.map(p => p.handle === handle ? { ...p, ...fields } : p)
                                };
                            });
                            supaUpdatePerson(handle, fields);
                        }}
                        onAddPerson={async (newPerson) => {
                            // Add person to local state + Supabase
                            const treeNode: TreeNode = {
                                handle: newPerson.handle,
                                displayName: newPerson.displayName,
                                gender: newPerson.gender,
                                generation: newPerson.generation,
                                birthYear: newPerson.birthYear,
                                isLiving: true,
                                isPrivacyFiltered: false,
                                isPatrilineal: newPerson.gender === 1,
                                families: [],
                                parentFamilies: newPerson.parentFamilyHandle ? [newPerson.parentFamilyHandle] : [],
                            };

                            setTreeData(prev => {
                                if (!prev) return null;
                                let newPeople = [...prev.people, treeNode];
                                let newFamilies = [...prev.families];

                                if (newPerson.parentFamilyHandle) {
                                    const existingFamily = newFamilies.find(f => f.handle === newPerson.parentFamilyHandle);
                                    if (existingFamily) {
                                        // Check if this is a spouse addition (same generation as parent)
                                        const parentInFamily = prev.people.find(p =>
                                            p.handle === existingFamily.fatherHandle || p.handle === existingFamily.motherHandle
                                        );
                                        if (parentInFamily && newPerson.generation === (parentInFamily as any).generation) {
                                            // Adding spouse
                                            if (newPerson.gender === 2 && !existingFamily.motherHandle) {
                                                newFamilies = newFamilies.map(f => f.handle === newPerson.parentFamilyHandle ? { ...f, motherHandle: newPerson.handle } : f);
                                                treeNode.families = [newPerson.parentFamilyHandle];
                                                treeNode.parentFamilies = [];
                                                treeNode.isPatrilineal = false;
                                            } else if (newPerson.gender === 1 && !existingFamily.fatherHandle) {
                                                newFamilies = newFamilies.map(f => f.handle === newPerson.parentFamilyHandle ? { ...f, fatherHandle: newPerson.handle } : f);
                                                treeNode.families = [newPerson.parentFamilyHandle];
                                                treeNode.parentFamilies = [];
                                                treeNode.isPatrilineal = false;
                                            }
                                        } else {
                                            // Adding child
                                            newFamilies = newFamilies.map(f =>
                                                f.handle === newPerson.parentFamilyHandle
                                                    ? { ...f, children: [...f.children, newPerson.handle] }
                                                    : f
                                            );
                                        }
                                    } else {
                                        // Create new family with selected person as parent
                                        const selectedPerson = prev.people.find(p => p.handle === selectedCard);
                                        if (selectedPerson) {
                                            if (newPerson.generation === selectedPerson.generation) {
                                                // Spouse - new family
                                                const newFamily: TreeFamily = {
                                                    handle: newPerson.parentFamilyHandle,
                                                    fatherHandle: selectedPerson.gender === 1 ? selectedPerson.handle : newPerson.handle,
                                                    motherHandle: selectedPerson.gender === 2 ? selectedPerson.handle : newPerson.handle,
                                                    children: [],
                                                };
                                                newFamilies.push(newFamily);
                                                // Immutable update: create new object for selectedPerson
                                                newPeople = newPeople.map(p =>
                                                    p.handle === selectedPerson.handle
                                                        ? { ...p, families: [...(p.families || []), newPerson.parentFamilyHandle!] }
                                                        : p
                                                );
                                                treeNode.families = [newPerson.parentFamilyHandle];
                                                treeNode.parentFamilies = [];
                                                treeNode.isPatrilineal = false;
                                            } else {
                                                // Child - new family
                                                const newFamily: TreeFamily = {
                                                    handle: newPerson.parentFamilyHandle,
                                                    fatherHandle: selectedPerson.gender === 1 ? selectedPerson.handle : undefined,
                                                    motherHandle: selectedPerson.gender === 2 ? selectedPerson.handle : undefined,
                                                    children: [newPerson.handle],
                                                };
                                                newFamilies.push(newFamily);
                                                // Immutable update: create new object for selectedPerson
                                                newPeople = newPeople.map(p =>
                                                    p.handle === selectedPerson.handle
                                                        ? { ...p, families: [...(p.families || []), newPerson.parentFamilyHandle!] }
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
                                handle: treeNode.handle,
                                displayName: treeNode.displayName,
                                gender: treeNode.gender,
                                generation: treeNode.generation,
                                birthYear: treeNode.birthYear,
                                isLiving: true,
                                families: treeNode.families,
                                parentFamilies: treeNode.parentFamilies,
                            });

                            // If we created a new family, persist it too
                            if (newPerson.parentFamilyHandle) {
                                const existingFamily = treeData?.families.find(f => f.handle === newPerson.parentFamilyHandle);
                                if (!existingFamily) {
                                    // New family was created - persist it
                                    const selectedPerson = treeData?.people.find(p => p.handle === selectedCard);
                                    if (selectedPerson) {
                                        if (newPerson.generation === selectedPerson.generation) {
                                            await supaAddFamily({
                                                handle: newPerson.parentFamilyHandle,
                                                fatherHandle: selectedPerson.gender === 1 ? selectedPerson.handle : newPerson.handle,
                                                motherHandle: selectedPerson.gender === 2 ? selectedPerson.handle : newPerson.handle,
                                                children: [],
                                            });
                                        } else {
                                            await supaAddFamily({
                                                handle: newPerson.parentFamilyHandle,
                                                fatherHandle: selectedPerson.gender === 1 ? selectedPerson.handle : undefined,
                                                motherHandle: selectedPerson.gender === 2 ? selectedPerson.handle : undefined,
                                                children: [newPerson.handle],
                                            });
                                        }
                                        // Persist parent's updated families to Supabase (fixes collapse bug after reload)
                                        await supaUpdatePersonFamilies(
                                            selectedPerson.handle,
                                            [...(selectedPerson.families || []), newPerson.parentFamilyHandle],
                                        );
                                    }
                                } else {
                                    // Existing family - update children or spouse
                                    const parentInFamily = treeData?.people.find(p =>
                                        p.handle === existingFamily.fatherHandle || p.handle === existingFamily.motherHandle
                                    );
                                    if (parentInFamily && newPerson.generation === (parentInFamily as any).generation) {
                                        // Spouse update handled by supabase
                                    } else {
                                        await supaUpdateFamilyChildren(newPerson.parentFamilyHandle, [...existingFamily.children, newPerson.handle]);
                                    }
                                }
                            }
                        }}
                        onDeletePerson={async (handle) => {
                            setTreeData(prev => {
                                if (!prev) return null;
                                return {
                                    people: prev.people.filter(p => p.handle !== handle),
                                    families: prev.families.map(f => ({
                                        ...f,
                                        children: f.children.filter(c => c !== handle),
                                        fatherHandle: f.fatherHandle === handle ? undefined : f.fatherHandle,
                                        motherHandle: f.motherHandle === handle ? undefined : f.motherHandle,
                                    })).filter(f => f.fatherHandle || f.motherHandle || f.children.length > 0),
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
                    personHandle={contributePerson.handle}
                    personName={contributePerson.name}
                    onClose={() => setContributePerson(null)}
                />
            )}

            {/* Person detail panel */}
            {detailPerson && (
                <PersonDetailPanel
                    handle={detailPerson}
                    treeData={treeData}
                    onClose={() => setDetailPerson(null)}
                    onNavigate={(h) => setDetailPerson(h)}
                    onPersonUpdated={(h, fields) => {
                        setTreeData(prev => {
                            if (!prev) return null;
                            return {
                                ...prev,
                                people: prev.people.map(p => {
                                    if (p.handle !== h) return p;
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
        </div>
    );
}

// === Card Context Menu ===
function CardContextMenu({ person, x, y, canEdit, viewportRef, transform, onViewDetail, onShowDescendants, onShowAncestors, onSetFocus, onShowFull, onCopyLink, onContribute, onAddPerson, onClose }: {
    person: TreeNode;
    x: number;
    y: number;
    canEdit: boolean;
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
function QuickAddPersonDialog({ person, x, y, viewportRef, transform, onSubmit, onClose, nextChildHandle, nextSpouseHandle, nextFamilyHandle, treeData }: {
    person: TreeNode;
    x: number;
    y: number;
    viewportRef: React.RefObject<HTMLDivElement | null>;
    transform: { x: number; y: number; scale: number };
    onSubmit: (data: {
        handle: string; displayName: string; gender: number; generation: number;
        birthYear?: number; parentFamilyHandle?: string;
        nickName?: string; birthDate?: string; phone?: string;
        currentAddress?: string; education?: string; occupation?: string;
        notes?: string; title?: string; birthOrder?: number;
        maritalStatus?: string; bloodType?: string; isLiving?: boolean;
    }) => void;
    onClose: () => void;
    nextChildHandle: (generation: number) => string;
    nextSpouseHandle: (contextPersonHandle: string) => string;
    nextFamilyHandle: () => string;
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
    const [pos, setPos] = useState({ left: 0, top: 0 });

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
        const dH = dialog.offsetHeight || 600;
        if (posX + dW > vpW - 8) posX = vpW - dW - 8;
        if (posX < 8) posX = 8;
        if (posY + dH > vpH - 8) posY = vpH - dH - 8;
        if (posY < 8) posY = 8;
        setPos({ left: posX, top: posY });
    }, [x, y, transform, viewportRef]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !treeData) return;

        const generation = type === 'child' ? person.generation + 1 : person.generation;
        const handle = type === 'spouse'
            ? nextSpouseHandle(person.handle)
            : nextChildHandle(generation);

        let familyHandle: string | undefined;
        if (type === 'child') {
            const existingFamily = treeData.families.find(f => f.fatherHandle === person.handle || f.motherHandle === person.handle);
            familyHandle = existingFamily?.handle || nextFamilyHandle();
        } else {
            familyHandle = nextFamilyHandle();
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
            handle,
            displayName: name.trim(),
            gender,
            generation,
            birthYear: birthYear ? parseInt(birthYear) : undefined,
            parentFamilyHandle: familyHandle,
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

    const inputCls = "w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-300 bg-white";
    const labelCls = "text-[11px] font-medium text-slate-600 block mb-1";

    return (
        <div
            ref={dialogRef}
            className="absolute z-50 animate-in fade-in zoom-in-95 duration-150"
            style={{ left: pos.left, top: pos.top }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div className="bg-white/95 backdrop-blur-lg border border-slate-200 rounded-xl shadow-2xl
                py-4 px-3 sm:px-5 w-[calc(100vw-24px)] sm:w-[480px] max-h-[calc(100vh-40px)] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-semibold text-slate-800">Thêm người thân</span>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Person info */}
                <div className="text-[11px] text-slate-500 mb-3 px-2.5 py-2 bg-slate-50 rounded-lg">
                    {type === 'child' ? 'Con' : 'Vợ/Chồng'} của{' '}
                    <span className="font-semibold text-slate-700">{person.displayName}</span>
                    <span className="text-slate-400"> · Đời {person.generation}</span>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                    {/* Row 1: Relationship type */}
                    <div>
                        <label className={labelCls}>Quan hệ</label>
                        <div className="flex gap-1.5">
                            <button
                                type="button"
                                className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors flex items-center justify-center gap-1.5 ${
                                    type === 'child' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                                }`}
                                onClick={() => setType('child')}
                            >
                                <Baby className="w-3.5 h-3.5" />
                                Con
                            </button>
                            <button
                                type="button"
                                className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors flex items-center justify-center gap-1.5 ${
                                    type === 'spouse' ? 'bg-rose-50 border-rose-300 text-rose-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                                }`}
                                onClick={() => setType('spouse')}
                            >
                                <Heart className="w-3.5 h-3.5" />
                                Vợ/Chồng
                            </button>
                        </div>
                    </div>

                    {/* Row 2: Full name */}
                    <div>
                        <label className={labelCls}>Họ và tên <span className="text-red-400">*</span></label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Duy..." className={inputCls} autoFocus />
                    </div>

                    {/* Row 3: Nick name + Title */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Tên gọi khác</label>
                            <input type="text" value={nickName} onChange={(e) => setNickName(e.target.value)} placeholder="Biệt danh..." className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Chức danh</label>
                            <input type="text" value={titleField} onChange={(e) => setTitleField(e.target.value)} placeholder="Trưởng tộc..." className={inputCls} />
                        </div>
                    </div>

                    {/* Row 4: Birth date (day/month/year) */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className={labelCls}>Sinh ngày</label>
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
                    </div>

                    {/* Row 5: Gender + Birth order */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Giới tính</label>
                            <div className="flex gap-1">
                                <button type="button"
                                    className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors ${gender === 1 ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                    onClick={() => setGender(1)}>Nam</button>
                                <button type="button"
                                    className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors ${gender === 2 ? 'bg-pink-50 border-pink-300 text-pink-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                    onClick={() => setGender(2)}>Nữ</button>
                            </div>
                        </div>
                        <div>
                            <label className={labelCls}>Thứ tự (con thứ)</label>
                            <input type="number" value={birthOrder} onChange={(e) => setBirthOrder(e.target.value)} placeholder="1, 2, 3..." min="1" className={inputCls} />
                        </div>
                    </div>

                    {/* Row 6: Address + Phone */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Địa chỉ</label>
                            <input type="text" value={currentAddress} onChange={(e) => setCurrentAddress(e.target.value)} placeholder="Số nhà, đường..." className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Số điện thoại</label>
                            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0912..." className={inputCls} />
                        </div>
                    </div>

                    {/* Row 7: Marital status + Education */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Tình trạng hôn nhân</label>
                            <select value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)} className={inputCls}>
                                <option value="">— Chọn —</option>
                                <option value="single">Độc thân</option>
                                <option value="married">Đã kết hôn</option>
                                <option value="divorced">Đã ly hôn</option>
                                <option value="widowed">Góa</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Học vấn</label>
                            <input type="text" value={education} onChange={(e) => setEducation(e.target.value)} placeholder="Đại học..." className={inputCls} />
                        </div>
                    </div>

                    {/* Row 8: Blood type + Occupation */}
                    <div className="grid grid-cols-2 gap-3">
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
                        <div>
                            <label className={labelCls}>Nghề nghiệp</label>
                            <input type="text" value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="Giáo viên..." className={inputCls} />
                        </div>
                    </div>

                    {/* Row 9: Notes/Biography */}
                    <div>
                        <label className={labelCls}>Tiểu sử</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Ghi chú về tiểu sử, thành tựu..."
                            rows={3}
                            className={`${inputCls} resize-none`}
                        />
                    </div>

                    {/* Row 10: Is dead checkbox */}
                    <label className="flex items-center gap-2 cursor-pointer py-1">
                        <input type="checkbox" checked={isDead} onChange={(e) => setIsDead(e.target.checked)} className="rounded border-slate-300 text-blue-600 focus:ring-blue-400" />
                        <span className="text-xs text-slate-600">Đã mất</span>
                    </label>

                    {/* Submit buttons */}
                    <div className="flex gap-2 pt-1 border-t border-slate-100">
                        <button type="button" onClick={onClose}
                            className="flex-1 px-3 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                            Hủy bỏ
                        </button>
                        <button type="submit" disabled={!name.trim()}
                            className="flex-1 px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5">
                            <Save className="w-3.5 h-3.5" />
                            Lưu lại
                        </button>
                    </div>
                </form>
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
    prev.zoomLevel === next.zoomLevel &&
    prev.showCollapseToggle === next.showCollapseToggle &&
    prev.isCollapsed === next.isCollapsed &&
    prev.isDragging === next.isDragging &&
    prev.isDropTarget === next.isDropTarget &&
    prev.editorMode === next.editorMode
);

function PersonCard({ item, isHighlighted, isFocused, isHovered, isSelected, zoomLevel, showCollapseToggle, isCollapsed, isDragging, isDropTarget, editorMode, onHover, onClick, onSetFocus, onToggleCollapse, onDragStart }: {
    item: PositionedNode;
    isHighlighted: boolean;
    isFocused: boolean;
    isHovered: boolean;
    isSelected: boolean;
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
                onMouseEnter={() => onHover(node.handle)}
                onMouseLeave={() => onHover(null)}
                onClick={(e) => { e.stopPropagation(); onClick(node.handle, x + CARD_W, y + CARD_H / 2); }}
            >
                <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: dotColor }} />
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
        : isSelected ? 'ring-2 ring-blue-500 ring-offset-2 shadow-blue-200 shadow-lg'
        : isHighlighted ? 'ring-2 ring-amber-400 ring-offset-2'
            : isFocused ? 'ring-2 ring-indigo-400 ring-offset-2'
                : isHovered ? 'ring-1 ring-indigo-200' : '';

    // F1: COMPACT zoom → smaller card with just name + gen
    if (zoomLevel === 'compact') {
        return (
            <div
                className={`absolute rounded-lg border bg-gradient-to-br shadow-sm transition-all duration-200
                    ${editorMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} hover:shadow-md ${bgClass} ${glowClass}
                    ${isDead && !isDragging ? 'opacity-70' : ''} ${!isPatri && !isDragging ? 'opacity-80' : ''}`}
                style={{ left: x, top: y, width: CARD_W, height: CARD_H }}
                onMouseEnter={() => onHover(node.handle)}
                onMouseLeave={() => onHover(null)}
                onClick={(e) => { e.stopPropagation(); onClick(node.handle, x + CARD_W, y + CARD_H / 2); }}
                onMouseDown={(e) => { if (editorMode && e.button === 0) { e.stopPropagation(); onDragStart(node.handle, e.clientX, e.clientY); } }}
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
                {/* Collapse toggle */}
                {showCollapseToggle && (
                    <button
                        className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-10 w-5 h-5 rounded-full
                            bg-white border border-slate-300 shadow-sm flex items-center justify-center
                            hover:bg-slate-100 transition-colors"
                        onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.handle); }}
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
            onMouseEnter={() => onHover(node.handle)}
            onMouseLeave={() => onHover(null)}
            onClick={(e) => { e.stopPropagation(); onClick(node.handle, x + CARD_W, y + CARD_H / 2); }}
            onMouseDown={(e) => { if (editorMode && e.button === 0) { e.stopPropagation(); onDragStart(node.handle, e.clientX, e.clientY); } }}
            onContextMenu={(e) => { e.preventDefault(); onSetFocus(node.handle); }}
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

            {/* F4: Collapse toggle button */}
            {showCollapseToggle && (
                <button
                    className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10 w-6 h-6 rounded-full
                        bg-white border border-slate-300 shadow-sm flex items-center justify-center
                        hover:bg-amber-50 hover:border-amber-400 transition-colors"
                    onClick={(e) => { e.stopPropagation(); onToggleCollapse(node.handle); }}
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
    onReorderChildren: (familyHandle: string, newOrder: string[]) => void;
    onMoveChild: (childHandle: string, fromFamily: string, toFamily: string) => void;
    onRemoveChild: (childHandle: string, familyHandle: string) => void;
    onToggleLiving: (handle: string, isLiving: boolean) => void;
    onUpdatePerson: (handle: string, fields: Record<string, unknown>) => void;
    onAddPerson: (person: { handle: string; displayName: string; gender: number; generation: number; birthYear?: number; parentFamilyHandle?: string }) => void;
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

    const person = selectedCard ? treeData.people.find(p => p.handle === selectedCard) : null;

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
    }, [person?.handle]);

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
        ? treeData.families.find(f => f.fatherHandle === person.handle || f.motherHandle === person.handle)
        : null;

    // Find the family where this person is a child
    const childOfFamily = person
        ? treeData.families.find(f => f.children.includes(person.handle))
        : null;

    // Get parent person name
    const parentPerson = childOfFamily
        ? treeData.people.find(p => p.handle === childOfFamily.fatherHandle || p.handle === childOfFamily.motherHandle)
        : null;

    // Children of the selected person's family
    const children = parentFamily
        ? parentFamily.children.map(ch => treeData.people.find(p => p.handle === ch)).filter(Boolean) as TreeNode[]
        : [];

    // All families (for "change parent" dropdown) with labels
    const allParentFamilies = treeData.families.filter(f => f.fatherHandle || f.motherHandle);
    const parentFamiliesWithLabels = allParentFamilies.map(f => {
        const father = treeData.people.find(p => p.handle === f.fatherHandle);
        const gen = father ? (father as any).generation : '';
        const label = father ? father.displayName : f.handle;
        return { ...f, label, gen };
    });

    // Filter parent families by search term
    const filteredParentFamilies = parentSearch.trim()
        ? parentFamiliesWithLabels.filter(f =>
            f.label.toLowerCase().includes(parentSearch.toLowerCase()) ||
            f.handle.toLowerCase().includes(parentSearch.toLowerCase())
        )
        : parentFamiliesWithLabels;

    // Generate next handle (Dxx-yyy format for children, S_Dxx-yyy for spouses)
    const nextChildHandleEditor = (generation: number) => {
        const genStr = String(generation).padStart(2, '0');
        const prefix = `D${genStr}-`;
        const maxIdx = treeData.people
            .filter(p => p.handle.startsWith(prefix))
            .reduce((max, p) => {
                const idx = parseInt(p.handle.replace(prefix, '')) || 0;
                return Math.max(max, idx);
            }, 0);
        return `${prefix}${String(maxIdx + 1).padStart(3, '0')}`;
    };

    const nextSpouseHandleEditor = (contextPersonHandle: string) => {
        return `S_${contextPersonHandle}`;
    };

    const nextFamilyHandle = () => {
        const maxNum = treeData.families.reduce((max, f) => {
            const num = parseInt(f.handle.replace(/\D/g, '')) || 0;
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
            onUpdatePerson(person.handle, fields);
        }
        setDirty(false);
        setSaving(false);
    };

    const handleAddChild = () => {
        if (!person || !newChildName.trim()) return;
        const generation = (person as any).generation + 1;
        const handle = nextChildHandleEditor(generation);
        let familyHandle = parentFamily?.handle;

        // If person has no family yet, create one
        if (!familyHandle) {
            familyHandle = nextFamilyHandle();
        }

        onAddPerson({
            handle,
            displayName: newChildName.trim(),
            gender: newChildGender,
            generation,
            birthYear: newChildBirthYear ? parseInt(newChildBirthYear) : undefined,
            parentFamilyHandle: familyHandle,
        });

        setNewChildName('');
        setNewChildGender(1);
        setNewChildBirthYear('');
        setShowAddChild(false);
    };

    const handleAddSpouse = () => {
        if (!person || !newSpouseName.trim()) return;
        const generation = (person as any).generation;
        const handle = nextSpouseHandleEditor(person.handle);
        const familyHandle = parentFamily?.handle || nextFamilyHandle();

        onAddPerson({
            handle,
            displayName: newSpouseName.trim(),
            gender: person.gender === 1 ? 2 : 1, // opposite gender
            generation,
            birthYear: newSpouseBirthYear ? parseInt(newSpouseBirthYear) : undefined,
            parentFamilyHandle: familyHandle,
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
                            <p className="text-xs text-muted-foreground">Đời {(person as any).generation ?? '?'} · {person.handle}</p>
                            <button
                                className="text-[10px] px-1.5 py-0.5 rounded text-red-600 hover:bg-red-50 border border-red-200"
                                onClick={() => {
                                    if (confirm(`Xóa "${person.displayName}" khỏi gia phả? Hành động này không thể hoàn tác.`)) {
                                        onDeletePerson(person.handle);
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
                                onClick={() => onToggleLiving(person.handle, !person.isLiving)}
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
                                    <div key={child.handle} className="flex items-center gap-1 group">
                                        <GripVertical className="h-3 w-3 text-muted-foreground/40" />
                                        <span className={`text-xs mr-0.5 ${child.gender === 1 ? 'text-blue-500' : 'text-pink-500'}`}>{child.gender === 1 ? '♂' : '♀'}</span>
                                        <span className="flex-1 text-xs truncate">{child.displayName}</span>
                                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {idx > 0 && (
                                                <button className="p-0.5 rounded hover:bg-muted" title="Lên"
                                                    onClick={() => {
                                                        const newOrder = [...parentFamily!.children];
                                                        [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
                                                        onReorderChildren(parentFamily!.handle, newOrder);
                                                    }}>
                                                    <ArrowUp className="h-3 w-3" />
                                                </button>
                                            )}
                                            {idx < children.length - 1 && (
                                                <button className="p-0.5 rounded hover:bg-muted" title="Xuống"
                                                    onClick={() => {
                                                        const newOrder = [...parentFamily!.children];
                                                        [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
                                                        onReorderChildren(parentFamily!.handle, newOrder);
                                                    }}>
                                                    <ArrowDown className="h-3 w-3" />
                                                </button>
                                            )}
                                            <button className="p-0.5 rounded hover:bg-red-100 text-red-500" title="Xóa liên kết"
                                                onClick={() => {
                                                    if (confirm(`Xóa "${child.displayName}" khỏi danh sách con?`)) {
                                                        onRemoveChild(child.handle, parentFamily!.handle);
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
                                Hiện tại: <span className="font-medium text-foreground">{parentPerson?.displayName ?? childOfFamily.handle}</span>
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
                                                const isSelected = f.handle === childOfFamily.handle;
                                                return (
                                                    <button key={f.handle}
                                                        className={`w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 flex items-center gap-1 transition-colors ${isSelected ? 'bg-blue-100 font-semibold text-blue-700' : ''}`}
                                                        onClick={() => {
                                                            if (f.handle !== childOfFamily.handle) onMoveChild(person.handle, childOfFamily.handle, f.handle);
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
