import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '@/types';
import { loginUser as apiLoginUser, logoutUser as apiLogoutUser } from '@/lib/auth-api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, expectedRole: UserRole) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Role mapping from backend to frontend
const roleMapping: Record<string, UserRole> = {
  'Admin': 'admin',
  'Teacher': 'teacher',
  'Student': 'student',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        localStorage.removeItem('user');
      }
    }
  }, []);

  const login = async (email: string, password: string, expectedRole: UserRole): Promise<{ success: boolean; error?: string }> => {
    try {
      // Map frontend role to backend role format
      const backendRoleMap: Record<UserRole, string> = {
        'admin': 'Admin',
        'teacher': 'Teacher',
        'student': 'Student',
      };
      
      const response = await apiLoginUser(email, password, backendRoleMap[expectedRole]);
      
      // Map backend role to frontend role
      const backendRole = response.data.role?.toUpperCase() || '';
      const userRole = roleMapping[backendRole] || 'student';
      
      // Store tokens
      localStorage.setItem('access_token', response.data.access);
      localStorage.setItem('refresh_token', response.data.refresh);
      
      // Create user object
      const userData: User = {
        id: response.data.user_code,
        user_code: response.data.user_code,
        name: response.data.fullname,
        fullname: response.data.fullname,
        email: response.data.email,
        role: userRole,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${response.data.fullname}`,
      };
      
      // Store user data
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Login failed. Please try again.'
      };
    }
  };

  const logout = () => {
    apiLogoutUser();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
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
