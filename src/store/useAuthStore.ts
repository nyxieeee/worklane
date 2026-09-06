import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { supabaseService } from '../services/supabaseService';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  borderStyle?: string;
  provider: 'google' | 'email';
}

export interface RegisteredAccount {
  id: string;
  name: string;
  email: string;
  password?: string;
  avatarUrl?: string;
  provider: 'google' | 'email';
  createdAt: string;
}

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accounts: RegisteredAccount[];
  
  initializeAuth: () => Promise<void>;
  updateUserProfile: (updates: { name?: string; avatarUrl?: string; borderStyle?: string }) => Promise<{ success: boolean; error?: string }>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<{ success: boolean; requiresVerification?: boolean; error?: string }>;
  verifyEmailOtp: (email: string, token: string) => Promise<{ success: boolean; error?: string }>;
  resendVerificationOtp: (email: string) => Promise<{ success: boolean; error?: string }>;
  signInWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyRecoveryOtp: (email: string, token: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  signUpWithGoogle: (name: string, email: string) => Promise<{ success: boolean; error?: string }>;
  signInWithGoogle: (email?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;
}

function hashPassword(pass: string): string {
  let hash = 0x811c9dc5;
  const salt = 'worklane_auth_salt_v2';
  const str = salt + pass;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      accounts: [],

      initializeAuth: async () => {
        if (!isSupabaseConfigured()) return;
        
        try {
          const parseUser = (u: any): AuthUser => {
            const customAvatar = u.user_metadata?.custom_avatar_url;
            const fallbackAvatar = u.user_metadata?.avatar_url || u.user_metadata?.picture || u.identities?.[0]?.identity_data?.avatar_url || u.identities?.[0]?.identity_data?.picture;
            return {
              id: u.id,
              name: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'User',
              email: u.email || '',
              avatarUrl: customAvatar !== undefined ? (customAvatar || undefined) : fallbackAvatar,
              provider: (u.app_metadata?.provider as any) || (u.user_metadata?.provider as any) || 'email',
            };
          };

          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const parsed = parseUser(session.user);
            // Fetch potential custom profile from Supabase profiles table
            try {
              const { data: prof } = await supabase
                .from('profiles')
                .select('avatar_url, name, border_style')
                .or(`id.eq.${session.user.id},email.ilike.${session.user.email}`)
                .maybeSingle();
              if (prof?.avatar_url) {
                parsed.avatarUrl = prof.avatar_url;
              } else if (get().user?.avatarUrl && get().user?.email?.toLowerCase().trim() === session.user.email?.toLowerCase().trim()) {
                parsed.avatarUrl = get().user?.avatarUrl;
              }
              if (prof?.name) {
                parsed.name = prof.name;
              }
              if (prof?.border_style) {
                parsed.borderStyle = prof.border_style;
              }
            } catch {}

            set({ user: parsed, isAuthenticated: true });
            supabaseService.upsertProfile(parsed);
          }

          supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user) {
              const parsed = parseUser(session.user);
              try {
                const { data: prof } = await supabase
                  .from('profiles')
                  .select('avatar_url, name, border_style')
                  .or(`id.eq.${session.user.id},email.ilike.${session.user.email}`)
                  .maybeSingle();
                if (prof?.avatar_url) {
                  parsed.avatarUrl = prof.avatar_url;
                } else if (get().user?.avatarUrl && get().user?.email?.toLowerCase().trim() === session.user.email?.toLowerCase().trim()) {
                  parsed.avatarUrl = get().user?.avatarUrl;
                }
                if (prof?.name) {
                  parsed.name = prof.name;
                }
                if (prof?.border_style) {
                  parsed.borderStyle = prof.border_style;
                }
              } catch {}
              set({ user: parsed, isAuthenticated: true });
              supabaseService.upsertProfile(parsed);
            } else if (!session && isSupabaseConfigured()) {
              set({ user: null, isAuthenticated: false });
            }
          });
        } catch (err) {
          console.warn('[Supabase Auth] Init error:', err);
        }
      },

      updateUserProfile: async (updates: { name?: string; avatarUrl?: string; borderStyle?: string }) => {
        const { user, accounts } = get();
        if (!user) return { success: false, error: 'Not authenticated' };

        const newName = updates.name !== undefined ? updates.name.trim() : user.name;
        const newAvatar = updates.avatarUrl !== undefined ? updates.avatarUrl : user.avatarUrl;
        const newBorder = updates.borderStyle !== undefined ? updates.borderStyle : user.borderStyle;

        const updatedUser: AuthUser = {
          ...user,
          name: newName || 'User',
          avatarUrl: newAvatar || undefined,
          borderStyle: newBorder,
        };

        set({ user: updatedUser });

        // 1. Sync across all active boards and cards in memory
        try {
          const { useWorkStore } = await import('./useWorkStore');
          useWorkStore.getState().syncCurrentUserProfile(updatedUser);
        } catch (e) {
          console.warn('[updateUserProfile] workStore sync warning:', e);
        }

        // 2. Sync with Supabase (profiles table + auth metadata)
        if (isSupabaseConfigured()) {
          try {
            await supabaseService.upsertProfile(updatedUser);
            // Only store normal URLs in user_metadata; base64 data URLs must not be put into JWT metadata as they exceed header limits
            const metaUpdates: any = {
              name: newName,
              border_style: newBorder || 'none',
            };
            if (newAvatar && !newAvatar.startsWith('data:')) {
              metaUpdates.custom_avatar_url = newAvatar;
              metaUpdates.avatar_url = newAvatar;
              metaUpdates.picture = newAvatar;
            }
            await supabase.auth.updateUser({
              data: metaUpdates,
            });
          } catch (err: any) {
            console.warn('[Supabase Auth] UpdateProfile error:', err);
          }
        }

        // 3. Update local accounts
        const updatedAccounts = accounts.map(a =>
          a.email.toLowerCase() === user.email.toLowerCase()
            ? { ...a, name: newName, avatarUrl: newAvatar }
            : a
        );
        set({ accounts: updatedAccounts });

        return { success: true };
      },

      signUpWithEmail: async (name, email, password) => {
        const cleanEmail = email.trim().toLowerCase();

        if (isSupabaseConfigured()) {
          try {
            const { data, error } = await supabase.auth.signUp({
              email: cleanEmail,
              password,
              options: {
                data: {
                  name: name.trim() || cleanEmail.split('@')[0],
                },
                emailRedirectTo: window.location.origin,
              },
            });
            if (error) return { success: false, error: error.message };
            
            // If session is created immediately (email confirmation disabled in Supabase)
            if (data.session?.user) {
              const u = data.session.user;
              const authUser: AuthUser = {
                id: u.id,
                name: u.user_metadata?.name || name.trim() || cleanEmail.split('@')[0],
                email: cleanEmail,
                avatarUrl: u.user_metadata?.avatar_url,
                provider: 'email',
              };
              set({ user: authUser, isAuthenticated: true });
              return { success: true, requiresVerification: false };
            }

            // If email verification is required (user created but unconfirmed)
            return { success: true, requiresVerification: true };
          } catch (err: any) {
            return { success: false, error: err.message || 'Sign up failed' };
          }
        }

        // Local Fallback mode
        const { accounts } = get();
        const existing = accounts.find(a => a.email.toLowerCase() === cleanEmail);
        if (existing) {
          return { success: false, error: 'Email is already registered! Please sign in.' };
        }

        const newAccount: RegisteredAccount = {
          id: `usr_${Date.now()}`,
          name: name.trim() || cleanEmail.split('@')[0],
          email: cleanEmail,
          password: hashPassword(password),
          provider: 'email',
          createdAt: new Date().toISOString(),
        };

        set({ accounts: [...accounts, newAccount] });
        return { success: true, requiresVerification: true };
      },

      verifyEmailOtp: async (email: string, token: string) => {
        const cleanEmail = email.trim().toLowerCase();
        const cleanToken = token.trim();

        if (isSupabaseConfigured()) {
          try {
            const { data, error } = await supabase.auth.verifyOtp({
              email: cleanEmail,
              token: cleanToken,
              type: 'signup',
            });
            if (error) {
              // Try email type if signup type fails
              const retry = await supabase.auth.verifyOtp({
                email: cleanEmail,
                token: cleanToken,
                type: 'email',
              });
              if (retry.error) return { success: false, error: retry.error.message };
              if (retry.data?.user) {
                const u = retry.data.user;
                const authUser: AuthUser = {
                  id: u.id,
                  name: u.user_metadata?.name || cleanEmail.split('@')[0],
                  email: cleanEmail,
                  avatarUrl: u.user_metadata?.avatar_url,
                  provider: 'email',
                };
                set({ user: authUser, isAuthenticated: true });
                return { success: true };
              }
            }
            if (data?.user) {
              const u = data.user;
              const authUser: AuthUser = {
                id: u.id,
                name: u.user_metadata?.name || cleanEmail.split('@')[0],
                email: cleanEmail,
                avatarUrl: u.user_metadata?.avatar_url,
                provider: 'email',
              };
              set({ user: authUser, isAuthenticated: true });
              return { success: true };
            }
            return { success: true };
          } catch (err: any) {
            return { success: false, error: err.message || 'Verification failed' };
          }
        }

        // Local fallback: verify any 6-digit or matching token
        const { accounts } = get();
        const acc = accounts.find(a => a.email.toLowerCase() === cleanEmail);
        if (acc) {
          const authUser: AuthUser = {
            id: acc.id,
            name: acc.name,
            email: acc.email,
            avatarUrl: acc.avatarUrl,
            provider: 'email',
          };
          set({ user: authUser, isAuthenticated: true });
          return { success: true };
        }
        return { success: true };
      },

      resendVerificationOtp: async (email: string) => {
        const cleanEmail = email.trim().toLowerCase();
        if (isSupabaseConfigured()) {
          try {
            const { error } = await supabase.auth.resend({
              type: 'signup',
              email: cleanEmail,
              options: {
                emailRedirectTo: window.location.origin,
              },
            });
            if (error) return { success: false, error: error.message };
            return { success: true };
          } catch (err: any) {
            return { success: false, error: err.message || 'Failed to resend code' };
          }
        }
        return { success: true };
      },

      signInWithEmail: async (email, password) => {
        const cleanEmail = email.trim().toLowerCase();

        if (isSupabaseConfigured()) {
          try {
            const { data, error } = await supabase.auth.signInWithPassword({
              email: cleanEmail,
              password,
            });
            if (error) return { success: false, error: error.message };

            if (data.user) {
              const u = data.user;
              let avatar = u.user_metadata?.custom_avatar_url || u.user_metadata?.avatar_url;
              let name = u.user_metadata?.name || cleanEmail.split('@')[0];
              try {
                const { data: prof } = await supabase.from('profiles').select('avatar_url, name').eq('id', u.id).maybeSingle();
                if (prof?.avatar_url) avatar = prof.avatar_url;
                if (prof?.name) name = prof.name;
              } catch {}

              const authUser: AuthUser = {
                id: u.id,
                name,
                email: cleanEmail,
                avatarUrl: avatar,
                provider: 'email',
              };
              set({ user: authUser, isAuthenticated: true });
              return { success: true };
            }
          } catch (err: any) {
            return { success: false, error: err.message || 'Sign in failed' };
          }
        }

        // Local Fallback mode
        const { accounts } = get();
        const account = accounts.find(a => a.email.toLowerCase() === cleanEmail);
        if (!account) {
          return { success: false, error: 'Account not found! Please sign up first.' };
        }

        const hashedPassword = hashPassword(password);
        if (account.password && account.password !== hashedPassword && account.password !== password) {
          return { success: false, error: 'Incorrect password! Please try again.' };
        }

        const authUser: AuthUser = {
          id: account.id,
          name: account.name,
          email: account.email,
          avatarUrl: account.avatarUrl,
          provider: account.provider,
        };

        set({ user: authUser, isAuthenticated: true });
        return { success: true };
      },

      sendPasswordReset: async (email: string) => {
        const cleanEmail = email.trim().toLowerCase();
        if (isSupabaseConfigured()) {
          try {
            const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
              redirectTo: `${window.location.origin}/?reset=true`,
            });
            if (error) return { success: false, error: error.message };
            return { success: true };
          } catch (err: any) {
            return { success: false, error: err.message || 'Failed to send reset email' };
          }
        }
        return { success: true };
      },

      verifyRecoveryOtp: async (email: string, token: string) => {
        const cleanEmail = email.trim().toLowerCase();
        const cleanToken = token.trim();
        if (isSupabaseConfigured()) {
          try {
            const { error } = await supabase.auth.verifyOtp({
              email: cleanEmail,
              token: cleanToken,
              type: 'recovery',
            });
            if (error) return { success: false, error: error.message };
            return { success: true };
          } catch (err: any) {
            return { success: false, error: err.message || 'Invalid recovery code' };
          }
        }
        return { success: true };
      },

      updatePassword: async (newPassword: string) => {
        if (isSupabaseConfigured()) {
          try {
            const { error } = await supabase.auth.updateUser({
              password: newPassword,
            });
            if (error) return { success: false, error: error.message };
            return { success: true };
          } catch (err: any) {
            return { success: false, error: err.message || 'Failed to update password' };
          }
        }
        return { success: true };
      },

      signUpWithGoogle: async (name, email) => {
        const cleanEmail = email.trim().toLowerCase();

        if (isSupabaseConfigured()) {
          return get().signInWithGoogle();
        }

        // Local Fallback mode
        const { accounts } = get();
        const existing = accounts.find(a => a.email.toLowerCase() === cleanEmail);
        if (existing) {
          return { success: false, error: 'This Google account is already registered! Please sign in.' };
        }

        const newAccount: RegisteredAccount = {
          id: `goog_${Date.now()}`,
          name: name.trim() || cleanEmail.split('@')[0],
          email: cleanEmail,
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
          provider: 'google',
          createdAt: new Date().toISOString(),
        };

        set({ accounts: [...accounts, newAccount] });
        return { success: true };
      },

      signInWithGoogle: async (email?: string) => {
        if (isSupabaseConfigured()) {
          try {
            // Check if there is an active invite link so we don't lose it!
            const currentParams = new URLSearchParams(window.location.search);
            const joinBoard = currentParams.get('joinBoard') || currentParams.get('invite');
            const inviteRole = currentParams.get('role') || 'member';

            let redirectTo = window.location.origin;
            if (joinBoard) {
              const inviteObj = { boardId: joinBoard, role: inviteRole };
              try {
                localStorage.setItem('worklane_pending_invite', JSON.stringify(inviteObj));
                sessionStorage.setItem('worklane_pending_invite', JSON.stringify(inviteObj));
              } catch {}
              redirectTo = `${window.location.origin}/?joinBoard=${encodeURIComponent(joinBoard)}&role=${encodeURIComponent(inviteRole)}`;
            } else {
              if (window.location.search || window.location.hash) {
                window.history.replaceState({}, document.title, window.location.origin);
              }
            }

            const { error } = await supabase.auth.signInWithOAuth({
              provider: 'google',
              options: {
                redirectTo,
                queryParams: {
                  access_type: 'offline',
                  prompt: 'select_account',
                },
              },
            });
            if (error) return { success: false, error: error.message };
            return { success: true };
          } catch (err: any) {
            return { success: false, error: err.message || 'Google OAuth failed' };
          }
        }

        // Local Fallback mode
        const cleanEmail = (email || '').trim().toLowerCase();
        if (!cleanEmail) {
          return { success: false, error: 'Email is required' };
        }
        const { accounts } = get();
        let account = accounts.find(a => a.email.toLowerCase() === cleanEmail);
        if (!account) {
          account = {
            id: `goog_${Date.now()}`,
            name: cleanEmail.split('@')[0],
            email: cleanEmail,
            provider: 'google',
            createdAt: new Date().toISOString(),
          };
          set({ accounts: [...accounts, account] });
        }

        const authUser: AuthUser = {
          id: account.id,
          name: account.name,
          email: account.email,
          avatarUrl: account.avatarUrl,
          provider: 'google',
        };

        set({ user: authUser, isAuthenticated: true });
        return { success: true };
      },

      logout: async () => {
        if (isSupabaseConfigured()) {
          try {
            await supabase.auth.signOut();
          } catch (e) {
            console.warn('[Supabase Auth] SignOut error:', e);
          }
        }
        // Clear work state so a different user logging in on the same device
        // doesn't see the previous user's boards from localStorage
        try {
          const { useWorkStore } = await import('./useWorkStore');
          useWorkStore.setState({ boards: [], activeBoardId: null, lastMoveSnapshot: null });
        } catch {}
        set({ user: null, isAuthenticated: false });
      },

      deleteAccount: async () => {
        const { user, accounts } = get();
        if (!user) return { success: true };

        try {
          // 1. Remove user from all boards and task card assignments in work store
          try {
            const { useWorkStore } = await import('./useWorkStore');
            useWorkStore.getState().removeUserFromAllBoards(user.email);
          } catch (wErr) {
            console.warn('[AuthStore] Error purging from work store:', wErr);
          }

          // 2. Delete from Supabase tables (board_members, card_assignees, profiles, notifications)
          if (isSupabaseConfigured()) {
            await supabaseService.deleteAccount({ id: user.id, email: user.email });
          }

          const updatedAccounts = accounts.filter(
            a => a.email.toLowerCase() !== user.email.toLowerCase()
          );

          set({
            user: null,
            isAuthenticated: false,
            accounts: updatedAccounts,
          });

          try {
            sessionStorage.clear();
          } catch {}

          return { success: true };
        } catch (err: any) {
          console.error('[AuthStore] Error deleting account:', err);
          return { success: false, error: err.message || 'Failed to delete account' };
        }
      },
    }),
    { name: 'worklane_auth_store_v4' }
  )
);
