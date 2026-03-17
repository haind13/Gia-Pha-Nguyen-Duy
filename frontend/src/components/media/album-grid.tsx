'use client';

import { AlbumCard } from './album-card';
import type { Album } from '@/lib/media-data';

interface AlbumGridProps {
    albums: Album[];
    onAlbumClick?: (album: Album) => void;
}

export function AlbumGrid({ albums, onAlbumClick }: AlbumGridProps) {
    if (albums.length === 0) return null;

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
            {albums.map(album => (
                <AlbumCard
                    key={album.id}
                    album={album}
                    onClick={() => onAlbumClick?.(album)}
                />
            ))}
        </div>
    );
}
