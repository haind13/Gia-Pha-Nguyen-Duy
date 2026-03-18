'use client';

import { Image as ImageIcon } from 'lucide-react';
import { getPhotoThumbUrl, type Photo } from '@/lib/media-data';

interface PhotoCardProps {
    photo: Photo;
    onClick?: () => void;
}

export function PhotoCard({ photo, onClick }: PhotoCardProps) {
    const thumbnailSrc = getPhotoThumbUrl(photo, 400);
    const aspectRatio = (photo.width && photo.height)
        ? photo.width / photo.height
        : 1; // fallback to square

    return (
        <button
            onClick={onClick}
            className="group relative w-full overflow-hidden rounded-lg bg-muted cursor-pointer border border-transparent hover:border-primary/30 transition-all focus:outline-none focus:ring-2 focus:ring-primary"
            style={{ aspectRatio }}
        >
            {thumbnailSrc ? (
                <img
                    src={thumbnailSrc}
                    alt={photo.title || photo.file_name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
            ) : (
                <div className="flex h-full w-full items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end">
                <div className="p-2 opacity-0 group-hover:opacity-100 transition-opacity w-full">
                    <p className="text-xs text-white font-medium truncate drop-shadow">
                        {photo.title || photo.file_name}
                    </p>
                </div>
            </div>
        </button>
    );
}
