'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    X, ChevronLeft, ChevronRight, Heart, MessageCircle,
    Send, Loader2, ThumbsUp, Smile, Frown, Angry, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/components/auth-provider';
import {
    fetchPhotoDetail, addComment, deleteComment, toggleLike,
    type Photo, type PhotoDetail, type PhotoComment,
} from '@/lib/media-data';

interface LightboxProps {
    photos: Photo[];
    initialIndex: number;
    onClose: () => void;
}

const REACTIONS = [
    { key: 'like', emoji: '👍', label: 'Thích' },
    { key: 'love', emoji: '❤️', label: 'Yêu thích' },
    { key: 'haha', emoji: '😂', label: 'Haha' },
    { key: 'sad', emoji: '😢', label: 'Buồn' },
    { key: 'angry', emoji: '😡', label: 'Giận' },
];

export function PhotoLightbox({ photos, initialIndex, onClose }: LightboxProps) {
    const { user, isLoggedIn } = useAuth();
    const [index, setIndex] = useState(initialIndex);
    const [detail, setDetail] = useState<PhotoDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [commentText, setCommentText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showReactions, setShowReactions] = useState(false);
    const commentsEndRef = useRef<HTMLDivElement>(null);

    const photo = photos[index];
    const hasNext = index < photos.length - 1;
    const hasPrev = index > 0;

    // Load photo detail
    const loadDetail = useCallback(async () => {
        if (!photo) return;
        setLoading(true);
        try {
            const data = await fetchPhotoDetail(photo.id);
            setDetail(data);
        } catch {
            setDetail(null);
        } finally {
            setLoading(false);
        }
    }, [photo?.id]);

    useEffect(() => { loadDetail(); }, [loadDetail]);

    // Keyboard navigation
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft' && hasPrev) setIndex(i => i - 1);
            if (e.key === 'ArrowRight' && hasNext) setIndex(i => i + 1);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [hasPrev, hasNext, onClose]);

    // Scroll comments to bottom on new comment
    useEffect(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [detail?.comments.length]);

    const handleComment = async () => {
        if (!commentText.trim() || !user || submitting) return;
        setSubmitting(true);
        try {
            await addComment(photo.id, commentText.trim(), user.id);
            setCommentText('');
            await loadDetail();
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        await deleteComment(photo.id, commentId);
        await loadDetail();
    };

    const handleReaction = async (reaction: string) => {
        if (!user) return;
        await toggleLike(photo.id, user.id, reaction);
        setShowReactions(false);
        await loadDetail();
    };

    const imgSrc = detail?.photo?.downloadUrl || photo?.r2_url || photo?.onedrive_url || photo?.thumbnail_url || '';
    const userLike = detail?.likes?.items?.find(l => l.user_id === user?.id);

    return (
        <div className="fixed inset-0 z-50 bg-black/90 flex" onClick={onClose}>
            {/* Main content - prevent close on click */}
            <div className="flex flex-1 flex-col md:flex-row" onClick={e => e.stopPropagation()}>

                {/* Image area */}
                <div className="relative flex-1 flex items-center justify-center min-h-0 bg-black">
                    {/* Close button */}
                    <button onClick={onClose} className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition">
                        <X className="h-5 w-5" />
                    </button>

                    {/* Prev/Next */}
                    {hasPrev && (
                        <button onClick={() => setIndex(i => i - 1)} className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition">
                            <ChevronLeft className="h-6 w-6" />
                        </button>
                    )}
                    {hasNext && (
                        <button onClick={() => setIndex(i => i + 1)} className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition">
                            <ChevronRight className="h-6 w-6" />
                        </button>
                    )}

                    {/* Photo */}
                    {imgSrc ? (
                        <img
                            src={imgSrc}
                            alt={photo.title || photo.file_name}
                            className="max-h-full max-w-full object-contain select-none"
                        />
                    ) : (
                        <div className="text-muted-foreground">Không tải được ảnh</div>
                    )}

                    {/* Counter */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm bg-black/50 px-3 py-1 rounded-full">
                        {index + 1} / {photos.length}
                    </div>
                </div>

                {/* Sidebar */}
                <div className="w-full md:w-[360px] bg-card flex flex-col max-h-[40vh] md:max-h-full border-l">
                    {/* Header */}
                    <div className="p-4 border-b shrink-0">
                        <h3 className="font-semibold text-sm truncate">
                            {photo.title || photo.file_name}
                        </h3>
                        {photo.uploader?.display_name && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {photo.uploader.display_name} · {new Date(photo.created_at).toLocaleDateString('vi-VN')}
                            </p>
                        )}
                        {detail?.photo?.album && (
                            <Badge variant="secondary" className="mt-1 text-xs">
                                📁 {detail.photo.album.title}
                            </Badge>
                        )}
                    </div>

                    {/* Reactions bar */}
                    <div className="px-4 py-2 border-b flex items-center gap-2 shrink-0">
                        <div className="relative">
                            <Button
                                variant={userLike ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => isLoggedIn && setShowReactions(!showReactions)}
                                className="gap-1"
                            >
                                {userLike ? REACTIONS.find(r => r.key === userLike.reaction)?.emoji || '👍' : '👍'}
                                <span className="text-xs">
                                    {detail?.likes?.total || 0}
                                </span>
                            </Button>

                            {/* Reaction picker */}
                            {showReactions && (
                                <div className="absolute bottom-full left-0 mb-1 flex gap-0.5 bg-card border rounded-full px-1 py-0.5 shadow-lg">
                                    {REACTIONS.map(r => (
                                        <button
                                            key={r.key}
                                            onClick={() => handleReaction(r.key)}
                                            className="text-lg hover:scale-125 transition-transform px-1"
                                            title={r.label}
                                        >
                                            {r.emoji}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Reaction summary */}
                        {detail?.likes?.reactions && Object.keys(detail.likes.reactions).length > 0 && (
                            <div className="flex gap-0.5 text-sm">
                                {Object.entries(detail.likes.reactions).map(([reaction, count]) => (
                                    <span key={reaction} className="text-xs">
                                        {REACTIONS.find(r => r.key === reaction)?.emoji} {count}
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" />
                            {detail?.comments?.length || 0}
                        </div>
                    </div>

                    {/* Comments */}
                    <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 min-h-0">
                        {loading ? (
                            <div className="flex justify-center py-4">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : detail?.comments && detail.comments.length > 0 ? (
                            detail.comments.map(comment => (
                                <div key={comment.id} className="group">
                                    <div className="flex items-start gap-2">
                                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                                            {(comment.user?.display_name || '?')[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="bg-muted rounded-lg px-3 py-1.5">
                                                <p className="text-xs font-semibold">{comment.user?.display_name || 'Ẩn danh'}</p>
                                                <p className="text-sm">{comment.content}</p>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground mt-0.5 px-1">
                                                {new Date(comment.created_at).toLocaleString('vi-VN')}
                                            </p>
                                        </div>
                                        {user?.id && (
                                            <button
                                                onClick={() => handleDeleteComment(comment.id)}
                                                className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-muted-foreground text-center py-4">Chưa có bình luận</p>
                        )}
                        <div ref={commentsEndRef} />
                    </div>

                    {/* Comment input */}
                    {isLoggedIn && (
                        <div className="p-3 border-t flex gap-2 shrink-0">
                            <Input
                                value={commentText}
                                onChange={e => setCommentText(e.target.value)}
                                placeholder="Viết bình luận..."
                                className="text-sm"
                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleComment()}
                            />
                            <Button size="icon" onClick={handleComment} disabled={!commentText.trim() || submitting}>
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
