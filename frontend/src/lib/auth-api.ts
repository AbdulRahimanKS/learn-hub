import apiClient from './api';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    user_code: string;
    email: string;
    fullname: string;
    role: string;
    access: string;
    refresh: string;
  };
}

export interface ApiError {
  message: string;
  detail?: string;
}

/**
 * Login user with email and password
 */
export const loginUser = async (email: string, password: string, expectedRole?: string): Promise<LoginResponse> => {
  try {
    const response = await apiClient.post<LoginResponse>('/api/users/v1/login/', {
      email,
      password,
      expected_role: expectedRole,
    });
    return response.data;
  } catch (error: any) {
    // Handle different error scenarios
    if (error.response?.data) {
      throw new Error(error.response.data.message || error.response.data.detail || 'Login failed');
    }
    throw new Error('Network error. Please check your connection.');
  }
};

/**
 * Logout user (client-side token removal)
 */
export const logoutUser = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
};

/**
 * Refresh access token using refresh token
 */
export const refreshToken = async (): Promise<{ access: string }> => {
  const refresh = localStorage.getItem('refresh_token');
  if (!refresh) {
    throw new Error('No refresh token available');
  }

  try {
    const response = await apiClient.post('/api/users/v1/token/refresh/', {
      refresh,
    });
    return response.data;
  } catch (error: any) {
    throw new Error('Failed to refresh token');
  }
};
