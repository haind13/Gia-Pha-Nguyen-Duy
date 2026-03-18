'use client';

import { PhotoCard } from './photo-card';
import type { Photo } from '@/lib/media-data';

interface PhotoGridProps {
    photos: Photo[];
    onPhotoClick?: (index: number) => void;
}

export function PhotoGrid({ photos, onPhotoClick }: PhotoGridProps) {
    if (photos.length === 0) return null;

    return (
        <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-1.5 md:gap-2">
            {photos.map((photo, index) => (
                <div key={photo.id} className="break-inside-avoid mb-1.5 md:mb-2">
                    <PhotoCard
                        photo={photo}
                        onClick={() => onPhotoClick?.(index)}
                    />
                </div>
            ))}
        </div>
    );
}
