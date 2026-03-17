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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 md:gap-2">
            {photos.map((photo, index) => (
                <PhotoCard
                    key={photo.id}
                    photo={photo}
                    onClick={() => onPhotoClick?.(index)}
                />
            ))}
        </div>
    );
}
