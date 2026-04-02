import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '../lib/api';

interface User {
  id: string;
  email: string;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  roles: string[];
  is_active: boolean;
  has_pin: boolean;
  avatar_url: string | null;
  totp_enabled?: boolean;
  canSeeCases?: boolean;
  canSeeAlerts?: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isLocked: boolean;
  setLocked: (locked: boolean) => void;
  signIn: (email: string, password: string) => Promise<void>;
  verify2FA: (tempToken: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  unlockSession: (value: string) => Promise<void>;
  hasRole: (role: string) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLocked, setLockedRaw] = useState(() => sessionStorage.getItem('oris_locked') === 'true');

  const setLocked = (locked: boolean) => {
    setLockedRaw(locked);
    if (locked) {
      sessionStorage.setItem('oris_locked', 'true');
    } else {
      sessionStorage.removeItem('oris_locked');
    }
  };

  const fetchProfile = async () => {
    try {
      const data = await api.get('/auth/me');
      if (data && data.user) {
        return {
          ...data.user,
          roles: (function() {
            if (!data.user.role) return ['user'];
            if (Array.isArray(data.user.role)) return data.user.role;
            try {
              const parsed = JSON.parse(data.user.role);
              return Array.isArray(parsed) ? parsed : [String(parsed)];
            } catch {
              return [String(data.user.role)];
            }
          })(),
          has_pin: !!data.user.has_pin,
          avatar_url: data.user.avatar_url || null,
          canSeeCases: !!data.user.canSeeCases,
          canSeeAlerts: !!data.user.canSeeAlerts,
        };
      }
    } catch (err) {
      console.error('Erreur lors du chargement du profil:', err);
    }
    return null;
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile();
      setProfile(profileData);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // We no longer rely exclusively on the localStorage token, as the HttpOnly cookie holds the session.
    // Try to fetch the profile directly.
    (async () => {
      try {
        const profileData = await fetchProfile();
        if (isMounted) {
          if (profileData) {
            setUser({ id: profileData.id, email: profileData.email });
            setProfile(profileData);
          } else {
            api.setToken(null);
          }
        }
      } catch (e) {
        if (isMounted) api.setToken(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-refresh JWT every 6 hours to avoid session expiry
  useEffect(() => {
    if (!user) return;
    const REFRESH_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
    const refreshToken = async () => {
      try {
        const data = await api.post('/auth/refresh', {});
        if (data?.session?.access_token) {
          api.setToken(data.session.access_token);
        }
      } catch (err) {
        console.error('Token refresh failed:', err);
      }
    };
    const interval = setInterval(refreshToken, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [user]);

  const signIn = async (email: string, password: string) => {
    const data = await api.post('/auth/login', { email, password });

    // 2FA required — throw special error with temp_token
    if (data.requires_2fa) {
      const err: any = new Error('2FA_REQUIRED');
      err.requires_2fa = true;
      err.temp_token = data.temp_token;
      throw err;
    }

    if (data.session && data.session.access_token) {
      api.setToken(data.session.access_token);
      const profileData = await fetchProfile();
      if (profileData) {
        setUser({ id: profileData.id, email: profileData.email });
        setProfile(profileData);
        setLocked(false);
      } else {
        throw new Error('Could not fetch user profile after login');
      }
    } else {
      throw new Error('No access token returned');
    }
  };

  const verify2FA = async (tempToken: string, code: string) => {
    const data = await api.post('/auth/verify-2fa', { temp_token: tempToken, code });
    if (data.session && data.session.access_token) {
      api.setToken(data.session.access_token);
      const profileData = await fetchProfile();
      if (profileData) {
        setUser({ id: profileData.id, email: profileData.email });
        setProfile(profileData);
        setLocked(false);
      } else {
        throw new Error('Could not fetch user profile after 2FA');
      }
    } else {
      throw new Error('No access token returned');
    }
  };

  const signOut = async () => {
    try {
      await api.post('/auth/logout', {});
    } catch (e) { }
    api.setToken(null);
    setUser(null);
    setProfile(null);
    setLocked(false);
  };

  const unlockSession = async (value: string) => {
    if (profile?.has_pin) {
      await api.post('/auth/verify-pin', { pin: value });
    } else {
      await api.post('/auth/verify-password', { password: value });
    }
    setLocked(false);
  };

  const hasRole = (role: string): boolean => {
    if (!profile || !profile.roles) return false;
    return profile.roles.includes(role);
  };

  const hasAnyRole = (roles: string[]): boolean => {
    if (!profile || !profile.roles) return false;
    return roles.some(role => profile.roles.includes(role));
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isLocked, setLocked, signIn, verify2FA, signOut, refreshProfile, unlockSession, hasRole, hasAnyRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth doit être utilisé à l\'intérieur d\'un AuthProvider');
  }
  return context;
}
