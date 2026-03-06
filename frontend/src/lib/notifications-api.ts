import { apiClient } from './api';

export interface AppConfiguration {
  business_name: string;
  timezone: string;
  logo: string | null;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  notification_type: 'info' | 'warning' | 'success' | 'error';
  action_url: string | null;
  content_type?: number | null;
  object_id?: number | null;
  is_read: boolean;
  created_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface PaginatedNotificationResponse {
  current_page: number;
  total_pages: number;
  total_items: number;
  page_size: number;
  next: string | null;
  previous: string | null;
  data: Notification[];
}

export const appConfigApi = {
  getAppConfiguration: async () => {
    const response = await apiClient.get<ApiResponse<AppConfiguration>>('/api/users/v1/app-config/');
    return response.data;
  },
  updateAppConfiguration: async (formData: FormData) => {
    const response = await apiClient.patch<ApiResponse<AppConfiguration>>('/api/users/v1/app-config/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }
};

export const notificationsApi = {
  getNotifications: async (params?: { page?: number, page_size?: number, paginate?: boolean }) => {
    const response = await apiClient.get<ApiResponse<PaginatedNotificationResponse | Notification[]>>('/api/users/v1/notifications/', { params });
    return response.data;
  },

  markAsRead: async (id: number) => {
    const response = await apiClient.patch<ApiResponse<Notification>>(`/api/users/v1/notifications/${id}/`, { is_read: true });
    return response.data;
  },

  markAllAsRead: async () => {
    const response = await apiClient.post<ApiResponse<null>>('/api/users/v1/notifications/read-all/');
    return response.data;
  }
};
