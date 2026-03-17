'use client';

import { useEffect, useState, useCallback } from 'react';
import { Image as ImageIcon, Upload, RefreshCw, Loader2, Check, X, ArrowLeft, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/components/auth-provider';
import { PhotoGrid } from '@/components/media/photo-grid';
import { PhotoLightbox } from '@/components/media/photo-lightbox';
import { AlbumGrid } from '@/components/media/album-grid';
import { AlbumCreateDialog } from '@/components/media/album-create-dialog';
import { PhotoUploadDialog } from '@/components/media/photo-upload-dialog';
import {
    fetchAlbums, fetchPhotos, fetchAlbumDetail, updatePhoto, syncFromOneDrive,
    type Album, type Photo,
} from '@/lib/media-data';

export default function MediaLibraryPage() {
    const { user, isAdmin, isLoggedIn, canEdit } = useAuth();
    const [tab, setTab] = useState('photos');
    const [albums, setAlbums] = useState<Album[]>([]);
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [pendingPhotos, setPendingPhotos] = useState<Photo[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

    // Album detail view
    const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
    const [albumPhotos, setAlbumPhotos] = useState<Photo[]>([]);
    const [albumLoading, setAlbumLoading] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [albumsData, photosData] = await Promise.all([
                fetchAlbums(),
                fetchPhotos({ state: 'PUBLISHED', limit: 60 }),
            ]);
            setAlbums(albumsData);
            setPhotos(photosData.photos);

            if (isAdmin) {
                const pendingData = await fetchPhotos({ state: 'PENDING', limit: 50 });
                setPendingPhotos(pendingData.photos);
            }
        } catch (err) {
            console.error('Load media error:', err);
        } finally {
            setLoading(false);
        }
    }, [isAdmin]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const result = await syncFromOneDrive();
            alert(`Đồng bộ thành công! ${result.albumsSynced} album mới, ${result.photosSynced} ảnh mới.`);
            await loadData();
        } catch {
            alert('Đồng bộ thất bại. Kiểm tra cấu hình OneDrive.');
        } finally {
            setSyncing(false);
        }
    };

    const handleApprove = async (photoId: string) => {
        await updatePhoto(photoId, { state: 'PUBLISHED' });
        await loadData();
    };

    const handleReject = async (photoId: string) => {
        await updatePhoto(photoId, { state: 'REJECTED' });
        await loadData();
    };

    const handleAlbumClick = async (album: Album) => {
        setSelectedAlbum(album);
        setAlbumLoading(true);
        try {
            const data = await fetchAlbumDetail(album.id);
            setAlbumPhotos(data.photos);
        } catch {
            setAlbumPhotos([]);
        } finally {
            setAlbumLoading(false);
        }
    };

    const handleBackFromAlbum = () => {
        setSelectedAlbum(null);
        setAlbumPhotos([]);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <ImageIcon className="h-6 w-6" />Thư viện ảnh
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        {photos.length} ảnh · {albums.length} album
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {isAdmin && (
                        <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                            {syncing ? 'Đang đồng bộ...' : 'Đồng bộ OneDrive'}
                        </Button>
                    )}
                    {canEdit && (
                        <AlbumCreateDialog onCreated={loadData} />
                    )}
                    {isLoggedIn && (
                        <PhotoUploadDialog albums={albums} onUploaded={loadData} />
                    )}
                </div>
            </div>

            {/* Album detail view */}
            {selectedAlbum ? (
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="sm" onClick={handleBackFromAlbum}>
                            <ArrowLeft className="mr-1 h-4 w-4" />Quay lại
                        </Button>
                        <div>
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <FolderOpen className="h-5 w-5" />{selectedAlbum.title}
                            </h2>
                            {selectedAlbum.description && (
                                <p className="text-sm text-muted-foreground">{selectedAlbum.description}</p>
                            )}
                        </div>
                    </div>

                    {albumLoading ? (
                        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : albumPhotos.length === 0 ? (
                        <Card><CardContent className="flex flex-col items-center justify-center py-12">
                            <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">Album chưa có ảnh</p>
                        </CardContent></Card>
                    ) : (
                        <>
                            <PhotoGrid photos={albumPhotos} onPhotoClick={i => setLightboxIndex(i)} />
                            {lightboxIndex !== null && (
                                <PhotoLightbox
                                    photos={albumPhotos}
                                    initialIndex={lightboxIndex}
                                    onClose={() => setLightboxIndex(null)}
                                />
                            )}
                        </>
                    )}
                </div>
            ) : (
                /* Main tabs view */
                <Tabs value={tab} onValueChange={setTab}>
                    <TabsList>
                        <TabsTrigger value="photos">
                            Tất cả ảnh
                            {photos.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px]">{photos.length}</Badge>}
                        </TabsTrigger>
                        <TabsTrigger value="albums">
                            Albums
                            {albums.length > 0 && <Badge variant="secondary" className="ml-1.5 text-[10px]">{albums.length}</Badge>}
                        </TabsTrigger>
                        {isAdmin && pendingPhotos.length > 0 && (
                            <TabsTrigger value="pending">
                                Chờ duyệt
                                <Badge variant="destructive" className="ml-1.5 text-[10px]">{pendingPhotos.length}</Badge>
                            </TabsTrigger>
                        )}
                    </TabsList>

                    {/* All Photos */}
                    <TabsContent value="photos" className="mt-4">
                        {loading ? (
                            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
                        ) : photos.length === 0 ? (
                            <Card><CardContent className="flex flex-col items-center justify-center py-16">
                                <ImageIcon className="h-16 w-16 text-muted-foreground/30 mb-4" />
                                <p className="text-muted-foreground font-medium">Chưa có ảnh nào</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Tải ảnh lên hoặc đồng bộ từ OneDrive
                                </p>
                            </CardContent></Card>
                        ) : (
                            <>
                                <PhotoGrid photos={photos} onPhotoClick={i => setLightboxIndex(i)} />
                                {lightboxIndex !== null && (
                                    <PhotoLightbox
                                        photos={photos}
                                        initialIndex={lightboxIndex}
                                        onClose={() => setLightboxIndex(null)}
                                    />
                                )}
                            </>
                        )}
                    </TabsContent>

                    {/* Albums */}
                    <TabsContent value="albums" className="mt-4">
                        {loading ? (
                            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
                        ) : albums.length === 0 ? (
                            <Card><CardContent className="flex flex-col items-center justify-center py-16">
                                <FolderOpen className="h-16 w-16 text-muted-foreground/30 mb-4" />
                                <p className="text-muted-foreground font-medium">Chưa có album nào</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Tạo album mới hoặc đồng bộ từ OneDrive
                                </p>
                            </CardContent></Card>
                        ) : (
                            <AlbumGrid albums={albums} onAlbumClick={handleAlbumClick} />
                        )}
                    </TabsContent>

                    {/* Pending approval (admin) */}
                    {isAdmin && (
                        <TabsContent value="pending" className="mt-4">
                            {pendingPhotos.length === 0 ? (
                                <Card><CardContent className="flex flex-col items-center justify-center py-12">
                                    <Check className="h-12 w-12 text-green-500 mb-4" />
                                    <p className="text-muted-foreground">Không có ảnh nào chờ duyệt</p>
                                </CardContent></Card>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                    {pendingPhotos.map(photo => (
                                        <Card key={photo.id} className="overflow-hidden">
                                            <div className="aspect-square bg-muted">
                                                {photo.thumbnail_url ? (
                                                    <img src={photo.thumbnail_url} alt={photo.file_name} className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="flex h-full items-center justify-center">
                                                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                                    </div>
                                                )}
                                            </div>
                                            <CardContent className="p-2 space-y-1">
                                                <p className="text-xs font-medium truncate">{photo.title || photo.file_name}</p>
                                                <p className="text-[10px] text-muted-foreground">
                                                    {new Date(photo.created_at).toLocaleDateString('vi-VN')}
                                                </p>
                                                <div className="flex gap-1">
                                                    <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => handleApprove(photo.id)}>
                                                        <Check className="h-3 w-3 mr-1" />Duyệt
                                                    </Button>
                                                    <Button size="sm" variant="destructive" className="flex-1 h-7 text-xs" onClick={() => handleReject(photo.id)}>
                                                        <X className="h-3 w-3 mr-1" />Từ chối
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                    )}
                </Tabs>
            )}
        </div>
    );
}
