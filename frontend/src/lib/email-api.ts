import apiClient from './api';

export interface EmailConfig {
  id?: number;
  email: string;
  email_type: 'smtp';
  email_host?: string;
  email_port?: string;
  email_user?: string;
  email_password?: string;
  status?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface EmailConfigResponse {
  success: boolean;
  message: string;
  data: EmailConfig | null;
}

/**
 * Get current email configuration
 */
export const getEmailConfig = async (): Promise<EmailConfig | null> => {
  try {
    const response = await apiClient.get<EmailConfigResponse>('/api/users/v1/email-config/');
    return response.data.data;
  } catch (error: any) {
    if (error.response?.data) {
      throw new Error(error.response.data.message || 'Failed to fetch email configuration');
    }
    throw new Error('Network error. Please check your connection.');
  }
};

/**
 * List all email configurations
 */
export const listEmailConfigs = async (): Promise<EmailConfig[]> => {
  try {
    const response = await apiClient.get<{ success: boolean; message: string; data: EmailConfig[] }>('/api/users/v1/email-config/list/');
    return response.data.data || [];
  } catch (error: any) {
    if (error.response?.data) {
      throw new Error(error.response.data.message || 'Failed to fetch email configurations');
    }
    throw new Error('Network error. Please check your connection.');
  }
};

/**
 * Save email configuration (create or update)
 */
export const saveEmailConfig = async (data: EmailConfig): Promise<EmailConfig> => {
  try {
    const response = await apiClient.post<EmailConfigResponse>('/api/users/v1/email-config/save/', data);
    return response.data.data!;
  } catch (error: any) {
    if (error.response?.data) {
      throw new Error(error.response.data.message || error.response.data.detail || 'Failed to save email configuration');
    }
    throw new Error('Network error. Please check your connection.');
  }
};

/**
 * Toggle email configuration status
 */
export const toggleEmailConfig = async (id: number): Promise<void> => {
  try {
    await apiClient.patch(`/api/users/v1/email-config/${id}/toggle/`);
  } catch (error: any) {
    if (error.response?.data) {
      throw new Error(error.response.data.message || 'Failed to toggle email configuration');
    }
    throw new Error('Network error. Please check your connection.');
  }
};
