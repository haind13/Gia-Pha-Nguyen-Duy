'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'editor' | 'viewer' | 'member' | null;

interface Profile {
    id: string;
    email: string;
    display_name: string | null;
    role: UserRole;
    person_id: string | null;
    avatar_url: string | null;
    is_superadmin: boolean;
}

interface AuthState {
    user: User | null;
    session: Session | null;
    profile: Profile | null;
    role: UserRole;
    loading: boolean;
    /** Global superadmin (manages all tenants) */
    isSuperAdmin: boolean;
    /** Current tenant role (from tenant_members) */
    tenantRole: UserRole;
    /** Is admin of current tenant OR superadmin */
    isAdmin: boolean;
    /** Can edit in current tenant (admin/editor) OR superadmin */
    canEdit: boolean;
    isMember: boolean;
    isLoggedIn: boolean;
    signIn: (email: string, password: string) => Promise<{ error?: string }>;
    signUp: (email: string, password: string, displayName?: string) => Promise<{ error?: string }>;
    signInWithGoogle: () => Promise<{ error?: string }>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    /** Set when TenantProvider detects a tenant */
    setCurrentTenantId: (tenantId: string | null) => void;
    currentTenantId: string | null;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);
    const [tenantRole, setTenantRole] = useState<UserRole>(null);

    const fetchProfile = useCallback(async (userId: string) => {
        try {
            // Try with is_superadmin first (after migration 016)
            let { data, error } = await supabase
                .from('profiles')
                .select('id, email, display_name, role, person_id, avatar_url, is_superadmin')
                .eq('id', userId)
                .maybeSingle();

            // Fallback: if is_superadmin column doesn't exist yet, query without it
            if (error && (error.message.includes('is_superadmin') || error.code === '42703' || error.message.includes('column'))) {
                const fallback = await supabase
                    .from('profiles')
                    .select('id, email, display_name, role, person_id, avatar_url')
                    .eq('id', userId)
                    .maybeSingle();
                data = fallback.data ? { ...fallback.data, is_superadmin: false } : null;
                error = fallback.error;
            }

            if (!error && data) {
                setProfile({
                    ...data,
                    is_superadmin: data.is_superadmin ?? false,
                } as Profile);
            } else {
                setProfile(null);
            }
        } catch {
            setProfile(null);
        }
    }, []);

    // Fetch tenant-specific role when tenant changes
    // Gracefully handles missing tenant_members table (before migration 016)
    const fetchTenantRole = useCallback(async (userId: string, tenantId: string) => {
        try {
            const { data, error } = await supabase
                .from('tenant_members')
                .select('role')
                .eq('user_id', userId)
                .eq('tenant_id', tenantId)
                .maybeSingle();
            // If table doesn't exist yet, silently fall back to null (uses global role)
            if (error && (error.message.includes('tenant_members') || error.code === '42P01' || error.message.includes('relation'))) {
                setTenantRole(null);
                return;
            }
            setTenantRole((data?.role as UserRole) ?? null);
        } catch {
            setTenantRole(null);
        }
    }, []);

    useEffect(() => {
        if (user && currentTenantId) {
            fetchTenantRole(user.id, currentTenantId);
        } else {
            setTenantRole(null);
        }
    }, [user, currentTenantId, fetchTenantRole]);

    const ensureProfile = useCallback(async (u: User) => {
        const { data: existing } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', u.id)
            .maybeSingle();

        if (!existing) {
            await supabase.from('profiles').insert({
                id: u.id,
                email: u.email || '',
                display_name: u.user_metadata?.display_name || u.email?.split('@')[0] || '',
                role: 'viewer',
            });
        }
        await fetchProfile(u.id);
    }, [fetchProfile]);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session: s } }) => {
            setSession(s);
            setUser(s?.user ?? null);
            if (s?.user) ensureProfile(s.user);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
            setSession(s);
            setUser(s?.user ?? null);
            if (s?.user) {
                ensureProfile(s.user);
            } else {
                setProfile(null);
                setTenantRole(null);
            }
        });

        return () => subscription.unsubscribe();
    }, [ensureProfile]);

    const signIn = useCallback(async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            if (error.message.includes('Invalid login credentials')) {
                return { error: 'Email hoặc mật khẩu không đúng' };
            }
            return { error: error.message };
        }
        return {};
    }, []);

    const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { display_name: displayName || email.split('@')[0] },
            },
        });
        if (error) {
            if (error.message.includes('already registered')) {
                return { error: 'Email đã được đăng ký. Hãy đăng nhập.' };
            }
            return { error: error.message };
        }
        if (data.user && !data.session) {
            return { error: 'Đã đăng ký! Kiểm tra email để xác nhận tài khoản.' };
        }
        return {};
    }, []);

    const signInWithGoogle = useCallback(async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/`,
            },
        });
        if (error) return { error: error.message };
        return {};
    }, []);

    const signOut = useCallback(async () => {
        await supabase.auth.signOut();
        setProfile(null);
        setTenantRole(null);
    }, []);

    const refreshProfile = useCallback(async () => {
        if (user) await fetchProfile(user.id);
    }, [user, fetchProfile]);

    const isSuperAdmin = profile?.is_superadmin ?? false;
    const role = profile?.role ?? null;

    // Effective admin: tenant admin OR superadmin OR legacy global admin
    const effectiveTenantRole = tenantRole ?? role; // fallback to global role if no tenant_members entry
    const isAdmin = isSuperAdmin || effectiveTenantRole === 'admin';
    const canEdit = isAdmin || effectiveTenantRole === 'editor';

    return (
        <AuthContext.Provider value={{
            user, session, profile, role, loading,
            isSuperAdmin,
            tenantRole: effectiveTenantRole,
            isAdmin,
            canEdit,
            isMember: effectiveTenantRole === 'member' || effectiveTenantRole === 'viewer' || canEdit,
            isLoggedIn: !!user,
            signIn, signUp, signInWithGoogle, signOut, refreshProfile,
            setCurrentTenantId,
            currentTenantId,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
