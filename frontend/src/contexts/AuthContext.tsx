import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi, setTokens, getTokens, clearTokens } from '../services/api';
import type { User, LoginForm } from '../types';

interface AuthContextType {
  user: User | null;
  permissions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginForm) => Promise<{ user: User }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (...roles: string[]) => boolean;
  canManageProgram: (programId: number) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  const checkAuth = async () => {
    const { accessToken } = getTokens();
    if (!accessToken) {
      setIsLoading(false);
      return;
    }

    try {
      const { user, permissions } = await authApi.getMe();
      setUser(user);
      setPermissions(permissions);
    } catch (error) {
      clearTokens();
      setUser(null);
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (data: LoginForm): Promise<{ user: User }> => {
    const response = await authApi.login(data);
    setTokens(response.access_token, response.refresh_token);
    setUser(response.user);
    setPermissions(response.permissions);
    return { user: response.user };
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Ignore logout errors
    } finally {
      clearTokens();
      setUser(null);
      setPermissions([]);
    }
  };

  const hasPermission = (permission: string) => {
    return permissions.includes(permission);
  };

  const hasRole = (...roles: string[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const canManageProgram = (_programId: number) => {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'committee') return true;
    // For program managers, this would need to be checked against their assigned programs
    // This is a simplified version - full implementation would track assigned programs
    return user.role === 'program_manager';
  };

  const refreshUser = async () => {
    try {
      const { user, permissions } = await authApi.getMe();
      setUser(user);
      setPermissions(permissions);
    } catch (error) {
      // Ignore refresh errors
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        isAuthenticated,
        isLoading,
        login,
        logout,
        checkAuth,
        refreshUser,
        hasPermission,
        hasRole,
        canManageProgram,
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

export default AuthContext;
