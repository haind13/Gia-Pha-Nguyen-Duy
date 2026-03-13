'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import LinkExtension from '@tiptap/extension-link';
import ImageExtension from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import {
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    Heading1, Heading2, Heading3,
    AlignLeft, AlignCenter, AlignRight, AlignJustify,
    List, ListOrdered, Quote,
    Link2, Image as ImageIcon, Undo2, Redo2, Minus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useCallback, useState } from 'react';

interface RichTextEditorProps {
    content: string;
    onChange: (html: string) => void;
    placeholder?: string;
}

function ToolbarButton({
    onClick, active, disabled, title, children,
}: {
    onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode;
}) {
    return (
        <Button
            type="button"
            variant={active ? 'default' : 'ghost'}
            size="icon"
            className={`h-8 w-8 ${active ? '' : 'hover:bg-accent'}`}
            onClick={onClick}
            disabled={disabled}
            title={title}
        >
            {children}
        </Button>
    );
}

export function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const [showImageInput, setShowImageInput] = useState(false);
    const [imageUrl, setImageUrl] = useState('');

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
            }),
            Underline,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            LinkExtension.configure({
                openOnClick: false,
                HTMLAttributes: { class: 'text-primary underline cursor-pointer' },
            }),
            ImageExtension.configure({
                HTMLAttributes: { class: 'rounded-lg max-w-full h-auto my-4' },
            }),
            Placeholder.configure({ placeholder: placeholder || 'Bắt đầu soạn thảo...' }),
        ],
        content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose-base dark:prose-invert max-w-none focus:outline-none min-h-[300px] px-4 py-3',
            },
        },
    });

    const addLink = useCallback(() => {
        if (!editor || !linkUrl) return;
        if (linkUrl === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
        } else {
            editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
        }
        setShowLinkInput(false);
        setLinkUrl('');
    }, [editor, linkUrl]);

    const addImage = useCallback(() => {
        if (!editor || !imageUrl) return;
        editor.chain().focus().setImage({ src: imageUrl }).run();
        setShowImageInput(false);
        setImageUrl('');
    }, [editor, imageUrl]);

    if (!editor) return null;

    return (
        <div className="border rounded-lg overflow-hidden bg-card">
            {/* Toolbar */}
            <div className="border-b bg-muted/30 px-2 py-1.5 flex flex-wrap items-center gap-0.5">
                {/* Undo / Redo */}
                <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Hoàn tác (Ctrl+Z)">
                    <Undo2 className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Làm lại (Ctrl+Y)">
                    <Redo2 className="h-4 w-4" />
                </ToolbarButton>

                <Separator orientation="vertical" className="h-6 mx-1" />

                {/* Text formatting */}
                <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bôi đậm (Ctrl+B)">
                    <Bold className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="In nghiêng (Ctrl+I)">
                    <Italic className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Gạch chân (Ctrl+U)">
                    <UnderlineIcon className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Gạch ngang">
                    <Strikethrough className="h-4 w-4" />
                </ToolbarButton>

                <Separator orientation="vertical" className="h-6 mx-1" />

                {/* Headings */}
                <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Tiêu đề 1">
                    <Heading1 className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Tiêu đề 2">
                    <Heading2 className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Tiêu đề 3">
                    <Heading3 className="h-4 w-4" />
                </ToolbarButton>

                <Separator orientation="vertical" className="h-6 mx-1" />

                {/* Alignment */}
                <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Căn trái">
                    <AlignLeft className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Căn giữa">
                    <AlignCenter className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Căn phải">
                    <AlignRight className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Căn đều">
                    <AlignJustify className="h-4 w-4" />
                </ToolbarButton>

                <Separator orientation="vertical" className="h-6 mx-1" />

                {/* Lists */}
                <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Danh sách">
                    <List className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Danh sách có số">
                    <ListOrdered className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Trích dẫn">
                    <Quote className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Đường kẻ ngang">
                    <Minus className="h-4 w-4" />
                </ToolbarButton>

                <Separator orientation="vertical" className="h-6 mx-1" />

                {/* Link */}
                <ToolbarButton onClick={() => { setShowLinkInput(!showLinkInput); setShowImageInput(false); }} active={editor.isActive('link')} title="Chèn liên kết">
                    <Link2 className="h-4 w-4" />
                </ToolbarButton>
                {/* Image */}
                <ToolbarButton onClick={() => { setShowImageInput(!showImageInput); setShowLinkInput(false); }} title="Chèn ảnh">
                    <ImageIcon className="h-4 w-4" />
                </ToolbarButton>
            </div>

            {/* Link input */}
            {showLinkInput && (
                <div className="border-b bg-muted/20 px-3 py-2 flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <input
                        type="url"
                        placeholder="https://..."
                        className="flex-1 text-sm bg-background border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                        value={linkUrl}
                        onChange={e => setLinkUrl(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addLink()}
                        autoFocus
                    />
                    <Button size="sm" className="h-7 text-xs" onClick={addLink}>Chèn</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowLinkInput(false); if (editor.isActive('link')) editor.chain().focus().unsetLink().run(); }}>
                        {editor.isActive('link') ? 'Xóa link' : 'Hủy'}
                    </Button>
                </div>
            )}

            {/* Image input */}
            {showImageInput && (
                <div className="border-b bg-muted/20 px-3 py-2 flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <input
                        type="url"
                        placeholder="URL ảnh: https://..."
                        className="flex-1 text-sm bg-background border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                        value={imageUrl}
                        onChange={e => setImageUrl(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addImage()}
                        autoFocus
                    />
                    <Button size="sm" className="h-7 text-xs" onClick={addImage}>Chèn</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowImageInput(false)}>Hủy</Button>
                </div>
            )}

            {/* Editor content */}
            <EditorContent editor={editor} />
        </div>
    );
}
