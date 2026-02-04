import apiClient from './api';

export interface OtpResponse {
  message: string;
  data: {
    email: string;
    expires_in_minutes?: number;
    verified?: boolean;
    password_reset?: boolean;
  };
}

/**
 * Request password reset OTP
 */
export const requestPasswordReset = async (email: string): Promise<OtpResponse> => {
  try {
    const response = await apiClient.post<OtpResponse>('/api/users/v1/password-reset/request/', {
      email,
    });
    return response.data;
  } catch (error: any) {
    if (error.response?.data) {
      throw new Error(error.response.data.message || error.response.data.detail || 'Failed to send OTP');
    }
    throw new Error('Network error. Please check your connection.');
  }
};

/**
 * Verify OTP
 */
export const verifyOTP = async (email: string, otp: string): Promise<OtpResponse> => {
  try {
    const response = await apiClient.post<OtpResponse>('/api/users/v1/password-reset/verify/', {
      email,
      otp,
    });
    return response.data;
  } catch (error: any) {
    if (error.response?.data) {
      throw new Error(error.response.data.message || error.response.data.detail || 'Invalid OTP');
    }
    throw new Error('Network error. Please check your connection.');
  }
};

/**
 * Reset Password
 */
export const resetPassword = async (email: string, otp: string, newPassword: string, confirmPassword: string): Promise<OtpResponse> => {
  try {
    const response = await apiClient.post<OtpResponse>('/api/users/v1/password-reset/confirm/', {
      email,
      otp,
      new_password: newPassword,
      confirm_password: confirmPassword,
    });
    return response.data;
  } catch (error: any) {
    if (error.response?.data) {
      throw new Error(error.response.data.message || error.response.data.detail || 'Failed to reset password');
    }
    throw new Error('Network error. Please check your connection.');
  }
};
