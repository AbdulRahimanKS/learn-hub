import apiClient from './api';

export interface UserProfileResponse {
  user_code: string;
  email: string;
  fullname: string;
  phone_number_code?: string;
  contact_number?: string;
  user_type: {
    name: string;
    description: string;
  };
  role?: string;
  profile: {
    address?: string;
    date_of_birth?: string;
    profile_picture?: string;
    bio?: string;
  };
  created_at: string;
  is_active: boolean;
}

export interface UpdateUserProfileRequest {
  fullname?: string;
  phone_number_code?: string;
  contact_number?: string;
  address?: string;
  date_of_birth?: string; // YYYY-MM-DD
  profile_picture?: string | File;
  bio?: string;
}

/**
 * Fetch the authenticated user's profile
 */
export const getUserProfile = async (): Promise<UserProfileResponse> => {
  try {
    const response = await apiClient.get<{ data: UserProfileResponse }>('/api/users/v1/profile/');
    return response.data.data;
  } catch (error: any) {
    if (error.response?.data) {
       throw new Error(error.response.data.message || 'Failed to fetch profile');
    }
    throw new Error('Network error. Please check your connection.');
  }
};

/**
 * Update the authenticated user's profile
 */
export const updateUserProfile = async (data: UpdateUserProfileRequest): Promise<UserProfileResponse> => {
  try {
    let payload: any = data;
    let headers: any = {};

    // Check if we need to send as FormData (if there's a file)
    const hasFile = data.profile_picture instanceof File;
    
    if (hasFile) {
        const formData = new FormData();
        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                formData.append(key, value);
            }
        });
        payload = formData;
        headers['Content-Type'] = 'multipart/form-data';
    }

    const response = await apiClient.patch<{ data: UserProfileResponse }>('/api/users/v1/profile/', payload, {
        headers
    });
    return response.data.data;
  } catch (error: any) {
    if (error.response?.data) {
       throw new Error(error.response.data.message || 'Failed to update profile');
    }
    throw new Error('Network error. Please check your connection.');
  }
};
