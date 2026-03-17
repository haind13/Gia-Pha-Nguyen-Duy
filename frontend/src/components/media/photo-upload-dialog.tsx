'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { uploadPhotos, type Album } from '@/lib/media-data';

interface UploadDialogProps {
    albums: Album[];
    onUploaded: () => void;
    trigger?: React.ReactNode;
}

export function PhotoUploadDialog({ albums, onUploaded, trigger }: UploadDialogProps) {
    const [open, setOpen] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [albumId, setAlbumId] = useState<string>('');
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const addFiles = useCallback((newFiles: File[]) => {
        const imageFiles = newFiles.filter(f => f.type.startsWith('image/'));
        setFiles(prev => [...prev, ...imageFiles]);
        const newPreviews = imageFiles.map(f => URL.createObjectURL(f));
        setPreviews(prev => [...prev, ...newPreviews]);
    }, []);

    const removeFile = (index: number) => {
        URL.revokeObjectURL(previews[index]);
        setFiles(prev => prev.filter((_, i) => i !== index));
        setPreviews(prev => prev.filter((_, i) => i !== index));
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const droppedFiles = Array.from(e.dataTransfer.files);
        addFiles(droppedFiles);
    };

    const handleUpload = async () => {
        if (!files.length) return;
        setUploading(true);
        try {
            await uploadPhotos(files, albumId || undefined);
            // Cleanup
            previews.forEach(p => URL.revokeObjectURL(p));
            setFiles([]);
            setPreviews([]);
            setOpen(false);
            onUploaded();
        } catch (err) {
            alert('Upload thất bại. Vui lòng thử lại.');
        } finally {
            setUploading(false);
        }
    };

    const reset = () => {
        previews.forEach(p => URL.revokeObjectURL(p));
        setFiles([]);
        setPreviews([]);
        setAlbumId('');
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button><Upload className="mr-2 h-4 w-4" />Tải ảnh lên</Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5" />Tải ảnh lên
                    </DialogTitle>
                </DialogHeader>

                {/* Album selector */}
                {albums.length > 0 && (
                    <div>
                        <label className="text-sm font-medium">Album</label>
                        <select
                            value={albumId}
                            onChange={e => setAlbumId(e.target.value)}
                            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                        >
                            <option value="">Không thuộc album nào</option>
                            {albums.map(a => (
                                <option key={a.id} value={a.id}>{a.title} ({a.photoCount} ảnh)</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Drop zone */}
                <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                        dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/20 hover:border-primary/50'
                    }`}
                >
                    <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                        Kéo thả ảnh vào đây hoặc <span className="text-primary font-medium">bấm để chọn</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">JPG, PNG, GIF, WebP</p>
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={e => {
                            const f = Array.from(e.target.files || []);
                            addFiles(f);
                            e.target.value = '';
                        }}
                    />
                </div>

                {/* Preview grid */}
                {files.length > 0 && (
                    <div>
                        <p className="text-sm font-medium mb-2">{files.length} ảnh đã chọn</p>
                        <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                            {previews.map((preview, i) => (
                                <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-muted group">
                                    <img src={preview} alt="" className="h-full w-full object-cover" />
                                    <button
                                        onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                                        className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                    <p className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[9px] px-1 py-0.5 truncate">
                                        {files[i].name}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={uploading}>
                        Hủy
                    </Button>
                    <Button onClick={handleUpload} disabled={!files.length || uploading}>
                        {uploading ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Đang tải...</>
                        ) : (
                            <><Upload className="mr-2 h-4 w-4" />Tải lên {files.length > 0 ? `(${files.length})` : ''}</>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
