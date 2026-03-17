'use client';

import { FolderOpen, Image as ImageIcon } from 'lucide-react';
import type { Album } from '@/lib/media-data';

interface AlbumCardProps {
    album: Album;
    onClick?: () => void;
}

export function AlbumCard({ album, onClick }: AlbumCardProps) {
    return (
        <button
            onClick={onClick}
            className="group text-left rounded-xl border bg-card overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
        >
            {/* Cover image */}
            <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                {album.coverUrl ? (
                    <img
                        src={album.coverUrl}
                        alt={album.title}
                        loading="lazy"
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                        <FolderOpen className="h-12 w-12 text-primary/30" />
                    </div>
                )}

                {/* Photo count badge */}
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" />
                    {album.photoCount}
                </div>
            </div>

            {/* Info */}
            <div className="p-3">
                <h3 className="font-semibold text-sm truncate">{album.title}</h3>
                {album.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{album.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                    {new Date(album.createdAt).toLocaleDateString('vi-VN')}
                </p>
            </div>
        </button>
    );
}
