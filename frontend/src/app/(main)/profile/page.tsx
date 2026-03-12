'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { RequireAuth } from '@/components/require-auth';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    User, Mail, Shield, KeyRound, Eye, EyeOff, Save, CheckCircle2, AlertCircle,
} from 'lucide-react';

export default function ProfilePage() {
    const { profile, isAdmin, canEdit, isMember, user, refreshProfile } = useAuth();

    /* ── Display name editing ── */
    const [displayName, setDisplayName] = useState(profile?.display_name || '');
    const [savingName, setSavingName] = useState(false);
    const [nameSuccess, setNameSuccess] = useState('');
    const [nameError, setNameError] = useState('');

    const handleSaveName = async () => {
        if (!user || !displayName.trim()) return;
        setSavingName(true);
        setNameSuccess('');
        setNameError('');
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ display_name: displayName.trim() })
                .eq('id', user.id);
            if (error) {
                setNameError(error.message);
            } else {
                setNameSuccess('Cập nhật tên hiển thị thành công!');
                await refreshProfile();
            }
        } catch {
            setNameError('Có lỗi xảy ra');
        } finally {
            setSavingName(false);
        }
    };

    /* ── Change password ── */
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [changingPw, setChangingPw] = useState(false);
    const [pwSuccess, setPwSuccess] = useState('');
    const [pwError, setPwError] = useState('');

    const handleChangePassword = async () => {
        setPwSuccess('');
        setPwError('');

        if (newPassword.length < 6) {
            setPwError('Mật khẩu mới phải có ít nhất 6 ký tự');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPwError('Xác nhận mật khẩu không khớp');
            return;
        }

        setChangingPw(true);
        try {
            // Verify current password by re-signing in
            const { error: signInErr } = await supabase.auth.signInWithPassword({
                email: user?.email || '',
                password: currentPassword,
            });
            if (signInErr) {
                setPwError('Mật khẩu hiện tại không đúng');
                setChangingPw(false);
                return;
            }

            // Update to new password
            const { error: updateErr } = await supabase.auth.updateUser({
                password: newPassword,
            });
            if (updateErr) {
                setPwError(updateErr.message);
            } else {
                setPwSuccess('Đổi mật khẩu thành công!');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            }
        } catch {
            setPwError('Có lỗi xảy ra');
        } finally {
            setChangingPw(false);
        }
    };

    const roleName = (role: string | null) => {
        switch (role) {
            case 'admin': return 'Quản trị viên';
            case 'editor': return 'Biên tập viên';
            case 'member': return 'Thành viên';
            case 'viewer': return 'Người xem';
            default: return 'Chưa xác định';
        }
    };

    return (
        <RequireAuth>
            <div className="max-w-2xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <User className="w-6 h-6 text-primary" />
                        Hồ sơ cá nhân
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Quản lý thông tin tài khoản và bảo mật
                    </p>
                </div>

                {/* ── Account Info ── */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Thông tin tài khoản</CardTitle>
                        <CardDescription>Xem và cập nhật thông tin cá nhân</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Email (read-only) */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5" /> Email
                            </label>
                            <Input value={profile?.email || ''} disabled className="bg-muted/50" />
                        </div>

                        {/* Display name */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5" /> Tên hiển thị
                            </label>
                            <div className="flex gap-2">
                                <Input
                                    value={displayName}
                                    onChange={(e) => { setDisplayName(e.target.value); setNameSuccess(''); setNameError(''); }}
                                    placeholder="Nhập tên hiển thị..."
                                />
                                <Button
                                    onClick={handleSaveName}
                                    disabled={savingName || displayName.trim() === (profile?.display_name || '')}
                                    size="sm"
                                    className="gap-1.5 shrink-0"
                                >
                                    <Save className="w-4 h-4" />
                                    {savingName ? 'Lưu...' : 'Lưu'}
                                </Button>
                            </div>
                            {nameSuccess && (
                                <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> {nameSuccess}
                                </p>
                            )}
                            {nameError && (
                                <p className="text-xs text-destructive flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" /> {nameError}
                                </p>
                            )}
                        </div>

                        {/* Role */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                                <Shield className="w-3.5 h-3.5" /> Vai trò
                            </label>
                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                                    isAdmin
                                        ? 'bg-primary/10 text-primary'
                                        : canEdit
                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                            : isMember
                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                : 'bg-muted text-muted-foreground'
                                }`}>
                                    {roleName(profile?.role ?? null)}
                                </span>
                                {profile?.person_handle && (
                                    <span className="text-xs text-muted-foreground">
                                        Liên kết: <code className="bg-muted px-1 rounded">{profile.person_handle}</code>
                                    </span>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* ── Change Password ── */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <KeyRound className="w-5 h-5 text-amber-600" />
                            Đổi mật khẩu
                        </CardTitle>
                        <CardDescription>Nhập mật khẩu hiện tại và mật khẩu mới để thay đổi</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {pwSuccess && (
                            <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 shrink-0" /> {pwSuccess}
                            </div>
                        )}
                        {pwError && (
                            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" /> {pwError}
                            </div>
                        )}

                        {/* Current password */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Mật khẩu hiện tại</label>
                            <div className="relative">
                                <Input
                                    type={showCurrent ? 'text' : 'password'}
                                    value={currentPassword}
                                    onChange={(e) => { setCurrentPassword(e.target.value); setPwError(''); }}
                                    placeholder="Nhập mật khẩu hiện tại..."
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    onClick={() => setShowCurrent(!showCurrent)}
                                >
                                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {/* New password */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Mật khẩu mới</label>
                            <div className="relative">
                                <Input
                                    type={showNew ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => { setNewPassword(e.target.value); setPwError(''); }}
                                    placeholder="Tối thiểu 6 ký tự..."
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    onClick={() => setShowNew(!showNew)}
                                >
                                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm new password */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Xác nhận mật khẩu mới</label>
                            <div className="relative">
                                <Input
                                    type={showConfirm ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => { setConfirmPassword(e.target.value); setPwError(''); }}
                                    placeholder="Nhập lại mật khẩu mới..."
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    onClick={() => setShowConfirm(!showConfirm)}
                                >
                                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <Button
                            onClick={handleChangePassword}
                            disabled={changingPw || !currentPassword || !newPassword || !confirmPassword}
                            className="w-full gap-2"
                        >
                            <KeyRound className="w-4 h-4" />
                            {changingPw ? 'Đang đổi mật khẩu...' : 'Đổi mật khẩu'}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </RequireAuth>
    );
}
