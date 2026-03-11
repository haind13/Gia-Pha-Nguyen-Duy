'use client';

import { useEffect, useState, useMemo } from 'react';
import { Users, ArrowLeftRight, Search, ChevronRight, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { fetchTreeData } from '@/lib/supabase-data';
import { getMockTreeData } from '@/lib/mock-data';
import { determineKinship, type KinshipResult, type PathStep } from '@/lib/kinship';
import type { TreeNode, TreeFamily } from '@/lib/tree-layout';

export default function KinshipPage() {
    const [people, setPeople] = useState<TreeNode[]>([]);
    const [families, setFamilies] = useState<TreeFamily[]>([]);
    const [loading, setLoading] = useState(true);

    const [personA, setPersonA] = useState<string>('');
    const [personB, setPersonB] = useState<string>('');
    const [searchA, setSearchA] = useState('');
    const [searchB, setSearchB] = useState('');
    const [showDropdownA, setShowDropdownA] = useState(false);
    const [showDropdownB, setShowDropdownB] = useState(false);
    const [result, setResult] = useState<KinshipResult | null>(null);
    const [noResult, setNoResult] = useState(false);

    // Load data
    useEffect(() => {
        const load = async () => {
            try {
                const data = await fetchTreeData();
                if (data.people.length > 0) {
                    setPeople(data.people);
                    setFamilies(data.families);
                    setLoading(false);
                    return;
                }
            } catch { /* fallback */ }
            const mock = getMockTreeData();
            setPeople(mock.people);
            setFamilies(mock.families);
            setLoading(false);
        };
        load();
    }, []);

    const personAData = useMemo(() => people.find(p => p.handle === personA), [people, personA]);
    const personBData = useMemo(() => people.find(p => p.handle === personB), [people, personB]);

    const filteredA = useMemo(() => {
        const q = searchA.toLowerCase();
        return people.filter(p => p.displayName.toLowerCase().includes(q)).slice(0, 10);
    }, [people, searchA]);

    const filteredB = useMemo(() => {
        const q = searchB.toLowerCase();
        return people.filter(p => p.displayName.toLowerCase().includes(q)).slice(0, 10);
    }, [people, searchB]);

    const handleDetermine = () => {
        if (!personA || !personB) return;
        const r = determineKinship(personA, personB, people, families);
        if (r) {
            setResult(r);
            setNoResult(false);
        } else {
            setResult(null);
            setNoResult(true);
        }
    };

    const swapPersons = () => {
        const tmpHandle = personA;
        const tmpSearch = searchA;
        setPersonA(personB);
        setPersonB(tmpHandle);
        setSearchA(searchB);
        setSearchB(tmpSearch);
        setResult(null);
        setNoResult(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Users className="h-6 w-6" /> Xưng hô
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Xác định cách xưng hô giữa hai người trong gia phả
                </p>
            </div>

            {/* Selection */}
            <Card>
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row items-center gap-4">
                        {/* Person A */}
                        <div className="flex-1 w-full">
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Người thứ nhất</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="searchA"
                                    placeholder="Tìm kiếm..."
                                    value={searchA}
                                    onChange={e => { setSearchA(e.target.value); setShowDropdownA(true); setPersonA(''); }}
                                    onFocus={() => setShowDropdownA(true)}
                                    onBlur={() => setTimeout(() => setShowDropdownA(false), 200)}
                                    className="pl-9"
                                />
                                {showDropdownA && filteredA.length > 0 && (
                                    <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                        {filteredA.map(p => (
                                            <button
                                                key={p.handle}
                                                className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2 ${personA === p.handle ? 'bg-accent' : ''}`}
                                                onMouseDown={(e) => { e.preventDefault(); setPersonA(p.handle); setSearchA(p.displayName); setShowDropdownA(false); setResult(null); }}
                                            >
                                                <span className={`text-xs ${p.gender === 1 ? 'text-blue-500' : 'text-pink-500'}`}>
                                                    {p.gender === 1 ? '♂' : '♀'}
                                                </span>
                                                <span className="font-medium">{p.displayName}</span>
                                                {p.birthYear && <span className="text-muted-foreground text-xs ml-auto">({p.birthYear})</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {personAData && (
                                <div className="mt-2 flex items-center gap-2 text-sm">
                                    <span className={`font-medium ${personAData.gender === 1 ? 'text-blue-600' : 'text-pink-600'}`}>
                                        {personAData.gender === 1 ? '♂' : '♀'} {personAData.displayName}
                                    </span>
                                    {personAData.birthYear && <span className="text-muted-foreground">({personAData.birthYear}{personAData.deathYear ? ` - ${personAData.deathYear}` : ''})</span>}
                                </div>
                            )}
                        </div>

                        {/* Swap button */}
                        <Button variant="outline" size="icon" className="shrink-0 mt-4 md:mt-0" onClick={swapPersons} title="Đổi chỗ">
                            <ArrowLeftRight className="h-4 w-4" />
                        </Button>

                        {/* Person B */}
                        <div className="flex-1 w-full">
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">Người thứ hai</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="searchB"
                                    placeholder="Tìm kiếm..."
                                    value={searchB}
                                    onChange={e => { setSearchB(e.target.value); setShowDropdownB(true); setPersonB(''); }}
                                    onFocus={() => setShowDropdownB(true)}
                                    onBlur={() => setTimeout(() => setShowDropdownB(false), 200)}
                                    className="pl-9"
                                />
                                {showDropdownB && filteredB.length > 0 && (
                                    <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                        {filteredB.map(p => (
                                            <button
                                                key={p.handle}
                                                className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2 ${personB === p.handle ? 'bg-accent' : ''}`}
                                                onMouseDown={(e) => { e.preventDefault(); setPersonB(p.handle); setSearchB(p.displayName); setShowDropdownB(false); setResult(null); }}
                                            >
                                                <span className={`text-xs ${p.gender === 1 ? 'text-blue-500' : 'text-pink-500'}`}>
                                                    {p.gender === 1 ? '♂' : '♀'}
                                                </span>
                                                <span className="font-medium">{p.displayName}</span>
                                                {p.birthYear && <span className="text-muted-foreground text-xs ml-auto">({p.birthYear})</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {personBData && (
                                <div className="mt-2 flex items-center gap-2 text-sm">
                                    <span className={`font-medium ${personBData.gender === 1 ? 'text-blue-600' : 'text-pink-600'}`}>
                                        {personBData.gender === 1 ? '♂' : '♀'} {personBData.displayName}
                                    </span>
                                    {personBData.birthYear && <span className="text-muted-foreground">({personBData.birthYear}{personBData.deathYear ? ` - ${personBData.deathYear}` : ''})</span>}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-4 flex justify-center">
                        <Button onClick={handleDetermine} disabled={!personA || !personB} className="px-8">
                            <Users className="h-4 w-4 mr-2" /> Xác định quan hệ
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Result */}
            {result && (
                <Card className="border-2 border-primary/20">
                    <CardContent className="p-6 space-y-6">
                        {/* Relationship title */}
                        <div className="text-center">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-primary font-semibold">
                                <Heart className="h-4 w-4" />
                                {result.relationship}
                            </div>
                        </div>

                        {/* Addressing */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 text-center space-y-2">
                                <div className="text-sm text-muted-foreground">
                                    <span className="font-semibold text-foreground">{personAData?.displayName}</span> gọi <span className="font-semibold text-foreground">{personBData?.displayName}</span> là
                                </div>
                                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                    {result.aCallsB}
                                </div>
                            </div>
                            <div className="bg-pink-50 dark:bg-pink-950/30 rounded-xl p-4 text-center space-y-2">
                                <div className="text-sm text-muted-foreground">
                                    <span className="font-semibold text-foreground">{personBData?.displayName}</span> gọi <span className="font-semibold text-foreground">{personAData?.displayName}</span> là
                                </div>
                                <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">
                                    {result.bCallsA}
                                </div>
                            </div>
                        </div>

                        {/* Path visualization */}
                        {result.path.length > 1 && (
                            <div>
                                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Đường đi trong gia phả</h3>
                                <div className="flex flex-wrap items-center gap-1">
                                    {result.path.map((step, i) => (
                                        <div key={step.personHandle} className="flex items-center gap-1">
                                            <div className={`
                                                px-3 py-1.5 rounded-lg text-sm font-medium border
                                                ${i === 0 ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300' :
                                                    i === result.path.length - 1 ? 'bg-pink-100 dark:bg-pink-900/40 border-pink-300 dark:border-pink-700 text-pink-700 dark:text-pink-300' :
                                                        'bg-muted border-border'}
                                            `}>
                                                <span className={`mr-1 text-xs ${step.gender === 1 ? 'text-blue-500' : 'text-pink-500'}`}>
                                                    {step.gender === 1 ? '♂' : '♀'}
                                                </span>
                                                {step.personName}
                                            </div>
                                            {i < result.path.length - 1 && (
                                                <div className="flex items-center text-muted-foreground">
                                                    <ChevronRight className="h-4 w-4" />
                                                    <span className="text-[10px] -ml-0.5 mr-0.5">
                                                        {result.path[i + 1].edgeType === 'parent' ? '↑cha/mẹ' :
                                                            result.path[i + 1].edgeType === 'child' ? '↓con' :
                                                                '♥ vợ/chồng'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {noResult && (
                <Card className="border-orange-200 dark:border-orange-800">
                    <CardContent className="p-6 text-center text-muted-foreground">
                        <p>Không tìm thấy mối quan hệ giữa hai người này trong gia phả.</p>
                        <p className="text-xs mt-1">Có thể họ thuộc các nhánh không liên kết.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
