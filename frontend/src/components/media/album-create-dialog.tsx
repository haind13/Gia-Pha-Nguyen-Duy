'use client';

import { useState } from 'react';
import { FolderPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { createAlbum } from '@/lib/media-data';

interface AlbumCreateDialogProps {
    onCreated: () => void;
    trigger?: React.ReactNode;
}

export function AlbumCreateDialog({ onCreated, trigger }: AlbumCreateDialogProps) {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [creating, setCreating] = useState(false);

    const handleCreate = async () => {
        if (!title.trim()) return;
        setCreating(true);
        try {
            await createAlbum(title.trim(), description.trim());
            setTitle('');
            setDescription('');
            setOpen(false);
            onCreated();
        } catch {
            alert('Tạo album thất bại');
        } finally {
            setCreating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline"><FolderPlus className="mr-2 h-4 w-4" />Tạo album</Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FolderPlus className="h-5 w-5" />Tạo album mới
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium">Tên album *</label>
                        <Input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="VD: Giỗ tổ 2025, Họp mặt gia đình..."
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Mô tả</label>
                        <Textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Mô tả ngắn về album..."
                            className="mt-1"
                            rows={3}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Album sẽ được tạo dưới dạng thư mục trên OneDrive. Bạn có thể thêm ảnh trực tiếp qua OneDrive.
                    </p>
                </div>

                <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={creating}>Hủy</Button>
                    <Button onClick={handleCreate} disabled={!title.trim() || creating}>
                        {creating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Đang tạo...</> : 'Tạo album'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
