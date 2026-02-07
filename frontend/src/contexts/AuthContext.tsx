import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '@/types';
import { loginUser as apiLoginUser, logoutUser as apiLogoutUser } from '@/lib/auth-api';
import { getUserProfile } from '@/lib/user-api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, expectedRole: UserRole) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Role mapping from backend to frontend
const roleMapping: Record<string, UserRole> = {
  'ADMIN': 'admin',
  'TEACHER': 'teacher',
  'STUDENT': 'student',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // Load user from localStorage on mount and refresh from API
  useEffect(() => {
    // 1. Initial load from local storage
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('access_token');
    
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        localStorage.removeItem('user');
      }
    }

    // 2. Fetch fresh profile from API
    if (token) {
      const fetchProfile = async () => {
        try {
          const profileData = await getUserProfile();
          
          const backendRole = (profileData.role || profileData.user_type?.name)?.toUpperCase() || '';
          const userRole = roleMapping[backendRole] || 'student';
          
          const userData: User = {
            id: profileData.user_code,
            user_code: profileData.user_code,
            name: profileData.fullname,
            fullname: profileData.fullname,
            email: profileData.email,
            role: userRole,
            avatar: profileData.profile?.profile_picture || '',
          };
          
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        } catch (error) {
          console.error("Failed to fetch user profile on init", error);
          // Only clear if strictly unauthorized? For now, we keep local state if network fails.
          // If the token is invalid, interceptors usually handle logout.
        }
      };
      
      fetchProfile();
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
        avatar: '',
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

  const updateUser = (data: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...data };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, updateUser }}>
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
