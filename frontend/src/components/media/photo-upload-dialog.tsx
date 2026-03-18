'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { uploadPhotos, type Album } from '@/lib/media-data';

interface UploadDialogProps {
    albums: Album[];
    onUploaded: () => void;
    trigger?: React.ReactNode;
}

/** Read image dimensions from a File */
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
            URL.revokeObjectURL(img.src);
        };
        img.onerror = () => resolve({ width: 0, height: 0 });
        img.src = URL.createObjectURL(file);
    });
}

/** Format file size for display */
function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const COMPRESSION_OPTIONS = {
    maxWidthOrHeight: 2048,
    maxSizeMB: 4,
    useWebWorker: true,
    fileType: 'image/jpeg' as const,
    initialQuality: 0.82,
};

export function PhotoUploadDialog({ albums, onUploaded, trigger }: UploadDialogProps) {
    const [open, setOpen] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [albumId, setAlbumId] = useState<string>('');
    const [status, setStatus] = useState<'idle' | 'compressing' | 'uploading'>('idle');
    const [compressionInfo, setCompressionInfo] = useState<string>('');
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
        try {
            // ── Step 1: Compress images ──
            setStatus('compressing');
            const originalSize = files.reduce((sum, f) => sum + f.size, 0);
            const compressedFiles: File[] = [];
            const dimensions: { width: number; height: number }[] = [];

            for (let i = 0; i < files.length; i++) {
                setCompressionInfo(`Đang nén ${i + 1}/${files.length}...`);
                const compressed = await imageCompression(files[i], COMPRESSION_OPTIONS);
                compressedFiles.push(compressed);
                const dim = await getImageDimensions(compressed);
                dimensions.push(dim);
            }

            const compressedSize = compressedFiles.reduce((sum, f) => sum + f.size, 0);
            const saved = Math.round((1 - compressedSize / originalSize) * 100);
            setCompressionInfo(`Nén xong: ${formatSize(originalSize)} → ${formatSize(compressedSize)} (giảm ${saved}%)`);

            // ── Step 2: Upload ──
            setStatus('uploading');
            await uploadPhotos(compressedFiles, albumId || undefined, dimensions);

            // Cleanup
            previews.forEach(p => URL.revokeObjectURL(p));
            setFiles([]);
            setPreviews([]);
            setOpen(false);
            onUploaded();
        } catch (err) {
            alert('Upload thất bại. Vui lòng thử lại.');
        } finally {
            setStatus('idle');
            setCompressionInfo('');
        }
    };

    const reset = () => {
        previews.forEach(p => URL.revokeObjectURL(p));
        setFiles([]);
        setPreviews([]);
        setAlbumId('');
        setStatus('idle');
        setCompressionInfo('');
    };

    const isWorking = status !== 'idle';

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
                    <p className="text-xs text-muted-foreground mt-1">JPG, PNG, GIF, WebP — tự động nén JPEG trước khi tải lên</p>
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
                        <p className="text-sm font-medium mb-2">
                            {files.length} ảnh đã chọn
                            <span className="text-muted-foreground font-normal ml-2">
                                ({formatSize(files.reduce((s, f) => s + f.size, 0))})
                            </span>
                        </p>
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

                {/* Compression info */}
                {compressionInfo && (
                    <p className="text-xs text-muted-foreground text-center">{compressionInfo}</p>
                )}

                {/* Actions */}
                <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isWorking}>
                        Hủy
                    </Button>
                    <Button onClick={handleUpload} disabled={!files.length || isWorking}>
                        {status === 'compressing' ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Đang nén...</>
                        ) : status === 'uploading' ? (
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
