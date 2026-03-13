'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    Bell, Plus, Trash2, Send, MessageCircle, Settings, ToggleLeft, ToggleRight,
    Info, ExternalLink, Clock, CalendarDays, Cake, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/components/auth-provider';
import { supabase } from '@/lib/supabase';

interface Channel {
    id: string;
    name: string;
    platform: 'zalo' | 'telegram';
    webhook_url: string;
    is_active: boolean;
    created_at: string;
}

interface ReminderSetting {
    id: string;
    channel_id: string;
    event_type: 'memorial' | 'birthday' | 'all';
    days_before: number;
    reminder_time: string;
    is_active: boolean;
}

const PLATFORM_INFO = {
    zalo: { label: 'Zalo', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: '💬' },
    telegram: { label: 'Telegram', color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300', icon: '✈️' },
};

const EVENT_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
    all: { label: 'Tất cả', icon: <CalendarDays className="h-3.5 w-3.5" /> },
    memorial: { label: 'Ngày giỗ', icon: <span>🕯️</span> },
    birthday: { label: 'Sinh nhật', icon: <Cake className="h-3.5 w-3.5" /> },
};

export default function AdminNotificationsPage() {
    const router = useRouter();
    const { isAdmin, loading: authLoading } = useAuth();
    const [channels, setChannels] = useState<Channel[]>([]);
    const [reminders, setReminders] = useState<ReminderSetting[]>([]);
    const [loading, setLoading] = useState(true);
    const [showChannelDialog, setShowChannelDialog] = useState(false);
    const [showReminderDialog, setShowReminderDialog] = useState(false);
    const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
    const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<{ id: string; status: 'success' | 'error'; msg: string } | null>(null);

    // Channel form
    const [channelForm, setChannelForm] = useState({ name: '', platform: 'zalo' as 'zalo' | 'telegram', webhook_url: '' });
    // Reminder form
    const [reminderForm, setReminderForm] = useState({ event_type: 'all' as 'memorial' | 'birthday' | 'all', days_before: 1, reminder_time: '08:00' });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [chRes, rmRes] = await Promise.all([
                supabase.from('notification_channels').select('*').order('created_at', { ascending: true }),
                supabase.from('reminder_settings').select('*').order('created_at', { ascending: true }),
            ]);
            if (chRes.data) setChannels(chRes.data);
            if (rmRes.data) setReminders(rmRes.data);
        } catch { /* tables may not exist yet */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        if (!authLoading && !isAdmin) { router.push('/'); return; }
        if (!authLoading && isAdmin) fetchData();
    }, [authLoading, isAdmin, router, fetchData]);

    // ── Channel CRUD ──
    const saveChannel = async () => {
        if (!channelForm.name || !channelForm.webhook_url) return;
        if (editingChannel) {
            await supabase.from('notification_channels')
                .update({ name: channelForm.name, platform: channelForm.platform, webhook_url: channelForm.webhook_url })
                .eq('id', editingChannel.id);
        } else {
            await supabase.from('notification_channels').insert({
                name: channelForm.name, platform: channelForm.platform, webhook_url: channelForm.webhook_url,
            });
        }
        setShowChannelDialog(false);
        setEditingChannel(null);
        setChannelForm({ name: '', platform: 'zalo', webhook_url: '' });
        fetchData();
    };

    const toggleChannel = async (ch: Channel) => {
        await supabase.from('notification_channels').update({ is_active: !ch.is_active }).eq('id', ch.id);
        setChannels(prev => prev.map(c => c.id === ch.id ? { ...c, is_active: !c.is_active } : c));
    };

    const deleteChannel = async (id: string) => {
        await supabase.from('notification_channels').delete().eq('id', id);
        fetchData();
    };

    const testWebhook = async (ch: Channel) => {
        setTestResult(null);
        try {
            const message = `[Gia phả Nguyễn Duy] Test kết nối kênh "${ch.name}" thành công! Thời gian: ${new Date().toLocaleString('vi-VN')}`;
            if (ch.platform === 'telegram') {
                // Telegram Bot API: webhook_url format = https://api.telegram.org/bot{TOKEN}/sendMessage?chat_id={CHAT_ID}
                const res = await fetch(ch.webhook_url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: message, parse_mode: 'HTML' }),
                });
                if (res.ok) setTestResult({ id: ch.id, status: 'success', msg: 'Gửi thành công!' });
                else setTestResult({ id: ch.id, status: 'error', msg: `Lỗi HTTP ${res.status}` });
            } else {
                // Zalo webhook — POST with message body
                const res = await fetch(ch.webhook_url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message }),
                });
                if (res.ok) setTestResult({ id: ch.id, status: 'success', msg: 'Gửi thành công!' });
                else setTestResult({ id: ch.id, status: 'error', msg: `Lỗi HTTP ${res.status}` });
            }
        } catch (err) {
            setTestResult({ id: ch.id, status: 'error', msg: 'Không thể kết nối. Kiểm tra lại URL webhook.' });
        }
    };

    // ── Reminder CRUD ──
    const saveReminder = async () => {
        if (!selectedChannelId) return;
        await supabase.from('reminder_settings').insert({
            channel_id: selectedChannelId,
            event_type: reminderForm.event_type,
            days_before: reminderForm.days_before,
            reminder_time: reminderForm.reminder_time,
        });
        setShowReminderDialog(false);
        setReminderForm({ event_type: 'all', days_before: 1, reminder_time: '08:00' });
        fetchData();
    };

    const toggleReminder = async (rm: ReminderSetting) => {
        await supabase.from('reminder_settings').update({ is_active: !rm.is_active }).eq('id', rm.id);
        setReminders(prev => prev.map(r => r.id === rm.id ? { ...r, is_active: !r.is_active } : r));
    };

    const deleteReminder = async (id: string) => {
        await supabase.from('reminder_settings').delete().eq('id', id);
        fetchData();
    };

    const openAddChannel = () => {
        setEditingChannel(null);
        setChannelForm({ name: '', platform: 'zalo', webhook_url: '' });
        setShowChannelDialog(true);
    };

    const openEditChannel = (ch: Channel) => {
        setEditingChannel(ch);
        setChannelForm({ name: ch.name, platform: ch.platform, webhook_url: ch.webhook_url });
        setShowChannelDialog(true);
    };

    const openAddReminder = (channelId: string) => {
        setSelectedChannelId(channelId);
        setReminderForm({ event_type: 'all', days_before: 1, reminder_time: '08:00' });
        setShowReminderDialog(true);
    };

    // Mask URL for display
    const maskUrl = (url: string) => {
        if (url.length <= 30) return url;
        return url.slice(0, 20) + '...' + url.slice(-10);
    };

    if (authLoading || loading) {
        return <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
    }

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <Bell className="h-6 w-6" />
                    Cấu hình nhắc sự kiện
                </h1>
                <p className="text-muted-foreground">Thiết lập gửi lời nhắc ngày giỗ, sinh nhật qua Zalo/Telegram</p>
            </div>

            {/* Section 1: Channels */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2"><MessageCircle className="h-5 w-5" /> Kênh thông báo</CardTitle>
                            <CardDescription>Các kênh Zalo/Telegram nhận lời nhắc sự kiện</CardDescription>
                        </div>
                        <Button size="sm" onClick={openAddChannel} className="gap-1"><Plus className="h-4 w-4" /> Thêm kênh</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {channels.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
                            <p>Chưa có kênh nào. Thêm kênh Zalo hoặc Telegram để bắt đầu.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {channels.map(ch => {
                                const pInfo = PLATFORM_INFO[ch.platform];
                                const chReminders = reminders.filter(r => r.channel_id === ch.id);
                                return (
                                    <div key={ch.id} className="border rounded-lg p-4 space-y-3">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <span className="text-xl">{pInfo.icon}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold text-sm">{ch.name}</h3>
                                                    <Badge variant="secondary" className={pInfo.color}>{pInfo.label}</Badge>
                                                    {ch.is_active ? (
                                                        <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Hoạt động</Badge>
                                                    ) : (
                                                        <Badge variant="secondary">Tạm dừng</Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-0.5 font-mono">{maskUrl(ch.webhook_url)}</p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => testWebhook(ch)} title="Gửi thử">
                                                    <Send className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleChannel(ch)} title={ch.is_active ? 'Tạm dừng' : 'Kích hoạt'}>
                                                    {ch.is_active ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4" />}
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditChannel(ch)} title="Sửa">
                                                    <Settings className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteChannel(ch.id)} title="Xóa">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Test result */}
                                        {testResult && testResult.id === ch.id && (
                                            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-md ${testResult.status === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
                                                {testResult.status === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                                {testResult.msg}
                                            </div>
                                        )}

                                        {/* Reminders for this channel */}
                                        <Separator />
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lịch nhắc</span>
                                                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => openAddReminder(ch.id)}>
                                                    <Plus className="h-3 w-3" /> Thêm
                                                </Button>
                                            </div>
                                            {chReminders.length === 0 ? (
                                                <p className="text-xs text-muted-foreground">Chưa có lịch nhắc. Thêm để tự động gửi nhắc sự kiện.</p>
                                            ) : (
                                                chReminders.map(rm => {
                                                    const et = EVENT_TYPE_LABELS[rm.event_type] || EVENT_TYPE_LABELS.all;
                                                    return (
                                                        <div key={rm.id} className="flex items-center gap-2 text-sm bg-muted/50 rounded-md px-3 py-2">
                                                            <span className="flex items-center gap-1">{et.icon} {et.label}</span>
                                                            <span className="text-muted-foreground">·</span>
                                                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Trước {rm.days_before} ngày, lúc {rm.reminder_time}</span>
                                                            <span className="flex-1" />
                                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleReminder(rm)}>
                                                                {rm.is_active ? <ToggleRight className="h-3.5 w-3.5 text-green-600" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteReminder(rm.id)}>
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Section 2: Guides */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2"><Info className="h-5 w-5" /> Hướng dẫn cài đặt</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <h3 className="font-semibold text-sm flex items-center gap-2">✈️ Telegram Bot</h3>
                        <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                            <li>Tạo Bot qua <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">@BotFather <ExternalLink className="h-3 w-3" /></a></li>
                            <li>Lấy Bot Token (VD: 123456:ABC-DEF)</li>
                            <li>Thêm Bot vào nhóm Telegram, lấy Chat ID</li>
                            <li>Webhook URL: <code className="text-xs bg-muted px-1 py-0.5 rounded">https://api.telegram.org/bot&#123;TOKEN&#125;/sendMessage?chat_id=&#123;CHAT_ID&#125;</code></li>
                        </ol>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                        <h3 className="font-semibold text-sm flex items-center gap-2">💬 Zalo Webhook</h3>
                        <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                            <li>Tạo Zalo OA (Official Account) hoặc dùng Zalo Group webhook</li>
                            <li>Cấu hình Webhook URL trong phần cài đặt</li>
                            <li>Dán URL webhook vào trường bên trên</li>
                        </ol>
                        <p className="text-xs text-muted-foreground italic">
                            Lưu ý: Tính năng gửi nhắc tự động yêu cầu backend cron job (Supabase Edge Function hoặc external service). Trang này chỉ cấu hình kênh và lịch nhắc.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Dialog: Add/Edit Channel */}
            <Dialog open={showChannelDialog} onOpenChange={setShowChannelDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingChannel ? 'Sửa kênh thông báo' : 'Thêm kênh thông báo'}</DialogTitle>
                        <DialogDescription>Cấu hình kênh Zalo hoặc Telegram để nhận lời nhắc sự kiện</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div>
                            <label className="text-sm font-medium">Tên kênh</label>
                            <Input placeholder="VD: Nhóm Zalo dòng họ" value={channelForm.name} onChange={e => setChannelForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Nền tảng</label>
                            <div className="flex gap-2 mt-1">
                                {(['zalo', 'telegram'] as const).map(p => (
                                    <Button key={p} variant={channelForm.platform === p ? 'default' : 'outline'} size="sm"
                                        onClick={() => setChannelForm(f => ({ ...f, platform: p }))}>
                                        {PLATFORM_INFO[p].icon} {PLATFORM_INFO[p].label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Webhook URL</label>
                            <Input placeholder={channelForm.platform === 'telegram' ? 'https://api.telegram.org/bot.../sendMessage?chat_id=...' : 'https://webhook.zalo.me/...'} value={channelForm.webhook_url} onChange={e => setChannelForm(f => ({ ...f, webhook_url: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowChannelDialog(false)}>Hủy</Button>
                        <Button onClick={saveChannel} disabled={!channelForm.name || !channelForm.webhook_url}>{editingChannel ? 'Cập nhật' : 'Thêm kênh'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog: Add Reminder */}
            <Dialog open={showReminderDialog} onOpenChange={setShowReminderDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Thêm lịch nhắc</DialogTitle>
                        <DialogDescription>Cấu hình tự động gửi nhắc trước sự kiện</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div>
                            <label className="text-sm font-medium">Loại sự kiện</label>
                            <div className="flex gap-2 mt-1">
                                {(['all', 'memorial', 'birthday'] as const).map(t => {
                                    const et = EVENT_TYPE_LABELS[t];
                                    return (
                                        <Button key={t} variant={reminderForm.event_type === t ? 'default' : 'outline'} size="sm"
                                            onClick={() => setReminderForm(f => ({ ...f, event_type: t }))} className="gap-1">
                                            {et.icon} {et.label}
                                        </Button>
                                    );
                                })}
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Nhắc trước</label>
                            <div className="flex gap-2 mt-1">
                                {[1, 3, 7].map(d => (
                                    <Button key={d} variant={reminderForm.days_before === d ? 'default' : 'outline'} size="sm"
                                        onClick={() => setReminderForm(f => ({ ...f, days_before: d }))}>
                                        {d} ngày
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Giờ gửi</label>
                            <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-background"
                                value={reminderForm.reminder_time} onChange={e => setReminderForm(f => ({ ...f, reminder_time: e.target.value }))}>
                                {['06:00', '07:00', '08:00', '09:00', '10:00', '12:00', '18:00', '20:00'].map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowReminderDialog(false)}>Hủy</Button>
                        <Button onClick={saveReminder}>Thêm lịch nhắc</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
