'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  _id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'moderator' | 'user';
  avatar?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  preferences: {
    language: string;
    timezone: string;
    notifications: {
      email: boolean;
      inApp: boolean;
      reminders: boolean;
    };
    theme: 'light' | 'dark' | 'auto';
  };
  permissions?: Record<string, boolean>;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  hasRole: (role: 'admin' | 'moderator' | 'user') => boolean;
  hasPermission: (permission: string) => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoLogoutConfig, setAutoLogoutConfig] = useState<{ enabled: boolean; minutes: number } | null>(null);
  const router = useRouter();
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showLogoutWarning, setShowLogoutWarning] = useState(false);

  // Role hierarchy for permission checking
  const roleHierarchy = { admin: 3, moderator: 2, user: 1 };

  // Check if user has specific role or higher
  const hasRole = (requiredRole: 'admin' | 'moderator' | 'user'): boolean => {
    if (!user) return false;
    const userLevel = roleHierarchy[user.role] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;
    return userLevel >= requiredLevel;
  };

  // Check if user has specific permission
  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    
    // If permissions are loaded from backend, use them
    if (user.permissions && typeof user.permissions[permission] !== 'undefined') {
      return user.permissions[permission];
    }
    
    // Fallback to role-based defaults if permissions not loaded
    const defaultPermissions: Record<string, string[]> = {
      admin: [
        'canCreateMeetings',
        'canModerateAllMeetings',
        'canViewAllMeetings',
        'canEditAllMinutes',
        'canDeleteMinutes',
        'canManageUsers',
        'canAssignModerators',
        'canExportData',
        'canAccessReports'
      ],
      moderator: [
        'canCreateMeetings',
        'canExportData'
      ],
      user: []
    };

    const userPermissions = defaultPermissions[user.role] || [];
    return userPermissions.includes(permission);
  };

  // Fetch current user
  const fetchCurrentUser = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.data);
        if (data.autoLogout) {
          setAutoLogoutConfig(data.autoLogout);
        }
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Refresh user data
  const refreshUser = async () => {
    await fetchCurrentUser();
  };

  // Login function
  const login = async (username: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Login failed');
      }

      const data = await response.json();
      setUser(data.user);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      router.push('/auth/login');
    }
  };

  // Update user data locally
  const updateUser = (userData: Partial<User>) => {
    setUser(current => current ? { ...current, ...userData } : null);
  };

  // Initialize auth state
  useEffect(() => {
    fetchCurrentUser();
  }, []);

  // Reset inactivity timer on user activity
  const resetInactivityTimer = useCallback(() => {
    if (!autoLogoutConfig?.enabled || !user) return;

    // Clear existing timers
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    setShowLogoutWarning(false);

    const timeoutMs = autoLogoutConfig.minutes * 60 * 1000;
    // Show warning 2 minutes before logout (or half the time if less than 4 minutes)
    const warningMs = Math.max(timeoutMs - 2 * 60 * 1000, timeoutMs / 2);

    warningTimerRef.current = setTimeout(() => {
      setShowLogoutWarning(true);
    }, warningMs);

    inactivityTimerRef.current = setTimeout(() => {
      setShowLogoutWarning(false);
      logout();
    }, timeoutMs);
  }, [autoLogoutConfig, user]);

  // Setup activity listeners for auto-logout
  useEffect(() => {
    if (!autoLogoutConfig?.enabled || !user) return;

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const handleActivity = () => resetInactivityTimer();

    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Start the initial timer
    resetInactivityTimer();

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    };
  }, [autoLogoutConfig, user, resetInactivityTimer]);

  const value = {
    user,
    loading,
    login,
    logout,
    updateUser,
    hasRole,
    hasPermission,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {showLogoutWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm mx-4 text-center">
            <div className="bg-amber-100 rounded-full p-3 mx-auto mb-4 w-14 h-14 flex items-center justify-center">
              <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Sitzung läuft ab</h3>
            <p className="text-gray-600 text-sm mb-4">
              Sie werden in Kürze wegen Inaktivität automatisch abgemeldet.
              Bewegen Sie die Maus oder drücken Sie eine Taste, um angemeldet zu bleiben.
            </p>
            <button
              onClick={resetInactivityTimer}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm"
            >
              Angemeldet bleiben
            </button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// HOC for protecting routes
export function withAuth<T extends object>(Component: React.ComponentType<T>) {
  return function AuthenticatedComponent(props: T) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!loading && !user) {
        router.push('/auth/login');
      }
    }, [user, loading, router]);

    if (loading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
            <p className="text-slate-600">Authentifizierung wird überprüft...</p>
          </div>
        </div>
      );
    }

    if (!user) {
      return null;
    }

    return <Component {...props} />;
  };
}

// HOC for protecting admin routes
export function withAdminAuth<T extends object>(Component: React.ComponentType<T>) {
  return function AdminAuthenticatedComponent(props: T) {
    const { user, loading, hasRole } = useAuth();
    const router = useRouter();
    const [redirecting, setRedirecting] = useState(false);

    useEffect(() => {
      if (!loading && !redirecting) {
        if (!user) {
          setRedirecting(true);
          router.push('/auth/login?redirect=/admin/settings');
        } else if (!hasRole('admin')) {
          setRedirecting(true);
          router.push('/');
        }
      }
    }, [user, loading, hasRole, router, redirecting]);

    if (loading || redirecting) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
            <p className="text-slate-600">Berechtigungen werden überprüft...</p>
          </div>
        </div>
      );
    }

    if (!user || !hasRole('admin')) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="bg-red-100 rounded-full p-4 mx-auto mb-4 w-16 h-16 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Zugriff verweigert</h1>
            <p className="text-slate-600 mb-6">
              Sie haben keine Berechtigung, auf diese Seite zuzugreifen. 
              Administrator-Berechtigungen sind erforderlich.
            </p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all"
            >
              Zur Startseite
            </button>
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
}

export default AuthContext;