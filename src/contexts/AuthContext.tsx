import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  must_set_password: boolean;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
}

interface UserRoleInfo {
  role: AppRole;
  branch_id?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  roles: UserRoleInfo[];
  isLoading: boolean;
  mustSetPassword: boolean;
  signInWithOtp: (email: string) => Promise<{ error: Error | null }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: Error | null }>;
  setPassword: (password: string) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<UserRoleInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [rolesLoaded, setRolesLoaded] = useState(false);

  const fetchProfile = async (userId: string, userEmail?: string) => {
    // Use maybeSingle to avoid 406 errors
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url, phone, must_set_password, emergency_contact_name, emergency_contact_phone')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }

    // If profile doesn't exist, attempt to create it (self-healing)
    if (!data && userEmail) {
      console.log('Profile missing, auto-creating for user:', userId);
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: userEmail,
          full_name: userEmail,
        })
        .select('id, email, full_name, avatar_url, phone, must_set_password, emergency_contact_name, emergency_contact_phone')
        .single();

      if (insertError) {
        console.error('Error creating profile:', insertError);
        return null;
      }
      return newProfile as UserProfile;
    }

    return data as UserProfile | null;
  };

  const fetchRoles = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching roles:', error);
      return [];
    }
    return data.map(r => ({ role: r.role as AppRole }));
  };

  const hydrateUser = async (userId: string, email?: string) => {
    setProfileLoaded(false);
    setRolesLoaded(false);

    const [profileData, rolesData] = await Promise.all([
      fetchProfile(userId, email),
      fetchRoles(userId),
    ]);

    setProfile(profileData);
    setProfileLoaded(true);
    setRoles(rolesData);
    setRolesLoaded(true);

    return { profileData, rolesData };
  };

  const refreshProfile = async () => {
    if (user) {
      await hydrateUser(user.id, user.email);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Defer to avoid deadlock
          setTimeout(() => {
            hydrateUser(session.user.id, session.user.email).then(() => {
              setIsLoading(false);
            });
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setProfileLoaded(false);
          setRolesLoaded(false);
          setIsLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        hydrateUser(session.user.id, session.user.email).then(() => {
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    // Safety timeout: never stay loading forever
    const safetyTimeout = setTimeout(() => {
      setIsLoading(false);
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  const signInWithOtp = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        shouldCreateUser: false, // Prevent OTP from creating new users
      },
    });
    return { error: error as Error | null };
  };

  const verifyOtp = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    return { error: error as Error | null };
  };

  const setPassword = async (password: string) => {
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) return { error: updateError as Error };

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ must_set_password: false })
      .eq('id', user?.id);

    if (profileError) return { error: profileError as Error };
    
    await refreshProfile();
    return { error: null };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    return { error: error as Error | null };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    sessionStorage.removeItem('current_branch_id');
    await supabase.auth.signOut();
    queryClient.clear();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
  };

  const hasRole = (role: AppRole) => {
    return roles.some(r => r.role === role);
  };

  const hasAnyRole = (checkRoles: AppRole[]) => {
    return roles.some(r => checkRoles.includes(r.role));
  };

  const mustSetPassword = profile?.must_set_password ?? false;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        isLoading,
        mustSetPassword,
        signInWithOtp,
        verifyOtp,
        setPassword,
        resetPassword,
        updatePassword,
        signOut,
        hasRole,
        hasAnyRole,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
