/**
 * Client-side data layer for Photo Gallery
 * Calls API routes which proxy to OneDrive + Supabase
 */

export interface Album {
    id: string;
    title: string;
    description: string;
    coverUrl: string | null;
    photoCount: number;
    createdAt: string;
}

export interface Photo {
    id: string;
    file_name: string;
    title: string | null;
    description: string | null;
    thumbnail_url: string | null;
    onedrive_url: string | null;
    width: number | null;
    height: number | null;
    state: string;
    album_id: string | null;
    created_at: string;
    uploader?: { display_name: string | null };
}

export interface PhotoDetail {
    photo: Photo & { downloadUrl: string; album?: { id: string; title: string } };
    comments: PhotoComment[];
    likes: {
        total: number;
        reactions: Record<string, number>;
        userIds: string[];
        items: { id: string; user_id: string; reaction: string }[];
    };
    tags: PhotoTag[];
}

export interface PhotoComment {
    id: string;
    content: string;
    created_at: string;
    user?: { display_name: string | null };
}

export interface PhotoTag {
    id: string;
    person_id: string;
    created_at: string;
}

// ═══ Albums ═══

export async function fetchAlbums(): Promise<Album[]> {
    const res = await fetch('/api/media/albums');
    if (!res.ok) throw new Error('Failed to fetch albums');
    return res.json();
}

export async function fetchAlbumDetail(albumId: string): Promise<{ album: any; photos: Photo[] }> {
    const res = await fetch(`/api/media/albums/${albumId}`);
    if (!res.ok) throw new Error('Failed to fetch album');
    return res.json();
}

export async function createAlbum(title: string, description?: string): Promise<Album> {
    const res = await fetch('/api/media/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
    });
    if (!res.ok) throw new Error('Failed to create album');
    return res.json();
}

export async function deleteAlbum(albumId: string): Promise<void> {
    const res = await fetch(`/api/media/albums/${albumId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete album');
}

// ═══ Photos ═══

export async function fetchPhotos(opts: {
    albumId?: string;
    state?: string;
    page?: number;
    limit?: number;
} = {}): Promise<{ photos: Photo[]; total: number; hasMore: boolean }> {
    const params = new URLSearchParams();
    if (opts.albumId) params.set('albumId', opts.albumId);
    if (opts.state) params.set('state', opts.state);
    if (opts.page) params.set('page', String(opts.page));
    if (opts.limit) params.set('limit', String(opts.limit));

    const res = await fetch(`/api/media/photos?${params}`);
    if (!res.ok) throw new Error('Failed to fetch photos');
    return res.json();
}

export async function fetchPhotoDetail(photoId: string): Promise<PhotoDetail> {
    const res = await fetch(`/api/media/photos/${photoId}`);
    if (!res.ok) throw new Error('Failed to fetch photo');
    return res.json();
}

export async function updatePhoto(photoId: string, updates: {
    title?: string;
    description?: string;
    state?: string;
}): Promise<void> {
    const res = await fetch(`/api/media/photos/${photoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update photo');
}

export async function deletePhoto(photoId: string): Promise<void> {
    const res = await fetch(`/api/media/photos/${photoId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete photo');
}

// ═══ Upload ═══

export async function uploadPhotos(
    files: File[],
    albumId?: string,
    onProgress?: (uploaded: number, total: number) => void,
): Promise<{ uploaded: any[]; count: number }> {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    if (albumId) formData.append('albumId', albumId);

    const res = await fetch('/api/media/photos', {
        method: 'POST',
        body: formData,
    });

    if (!res.ok) throw new Error('Upload failed');
    return res.json();
}

// ═══ Comments ═══

export async function addComment(photoId: string, content: string, userId: string): Promise<PhotoComment> {
    const res = await fetch(`/api/media/photos/${photoId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, userId }),
    });
    if (!res.ok) throw new Error('Failed to add comment');
    return res.json();
}

export async function deleteComment(photoId: string, commentId: string): Promise<void> {
    await fetch(`/api/media/photos/${photoId}/comments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId }),
    });
}

// ═══ Likes ═══

export async function toggleLike(photoId: string, userId: string, reaction = 'like'): Promise<{ action: string }> {
    const res = await fetch(`/api/media/photos/${photoId}/likes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, reaction }),
    });
    if (!res.ok) throw new Error('Failed to toggle like');
    return res.json();
}

// ═══ Tags ═══

export async function tagPerson(photoId: string, personId: string, taggedBy: string): Promise<PhotoTag> {
    const res = await fetch(`/api/media/photos/${photoId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, taggedBy }),
    });
    if (!res.ok) throw new Error('Failed to tag person');
    return res.json();
}

export async function removeTag(photoId: string, tagId: string): Promise<void> {
    await fetch(`/api/media/photos/${photoId}/tags`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId }),
    });
}

// ═══ Sync ═══

export async function syncFromOneDrive(): Promise<{ albumsSynced: number; photosSynced: number }> {
    const res = await fetch('/api/media/sync', { method: 'POST' });
    if (!res.ok) throw new Error('Sync failed');
    return res.json();
}
