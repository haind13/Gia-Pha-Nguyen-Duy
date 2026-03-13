import { Suspense } from 'react';
import TreeViewPage from '../../tree/tree-client';

export const dynamic = 'force-dynamic';

export default async function PhaDoViewPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    // Resolve params (Next.js 16 async params)
    const { slug } = await params;

    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center h-screen">
                    <div className="text-muted-foreground">Đang tải phả đồ...</div>
                </div>
            }
        >
            {/* For now, all slugs render the same tree data.
                In future, treeSlug can be used to filter people/families by tree_id */}
            <TreeViewPage />
        </Suspense>
    );
}
