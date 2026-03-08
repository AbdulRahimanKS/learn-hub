import { apiClient } from './api';

export interface Webinar {
  id: number;
  batch: number;
  title: string;
  session_type: 'webinar' | 'special_session';
  description: string;
  unlock_at: string;
  duration_secs: number;
  video_file: string | null;
  video_presigned_url: string | null;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebinarFormData {
  title: string;
  session_type: 'webinar' | 'special_session';
  description?: string;
  unlock_at: string;
  duration_secs: number;
  video_file?: File | null;
}

export interface PaginatedWebinarResponse {
  success: boolean;
  message: string;
  data: Webinar[];
  current_page: number;
  total_pages: number;
  total_items: number;
  page_size: number;
  next: string | null;
  previous: string | null;
}

export interface WebinarListParams {
  tab?: 'scheduled' | 'passed';
  page?: number;
  page_size?: number;
}

export const webinarApi = {
  getWebinars: async (batchId: number, params?: WebinarListParams): Promise<PaginatedWebinarResponse> => {
    const response = await apiClient.get<PaginatedWebinarResponse>(
      `/api/courses/v1/batches/${batchId}/webinars/`,
      { params }
    );
    return response.data;
  },

  getWebinar: async (batchId: number, webinarId: number) => {
    const response = await apiClient.get<{ data: Webinar; success: boolean; message: string }>(
      `/api/courses/v1/batches/${batchId}/webinars/${webinarId}/`
    );
    return response.data;
  },

  createWebinar: async (batchId: number, data: FormData) => {
    const response = await apiClient.post<{ data: Webinar; success: boolean; message: string }>(
      `/api/courses/v1/batches/${batchId}/webinars/`,
      data,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  updateWebinar: async (batchId: number, webinarId: number, data: FormData) => {
    const response = await apiClient.patch<{ success: boolean; message: string }>(
      `/api/courses/v1/batches/${batchId}/webinars/${webinarId}/`,
      data,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  deleteWebinar: async (batchId: number, webinarId: number) => {
    const response = await apiClient.delete<{ success: boolean; message: string }>(
      `/api/courses/v1/batches/${batchId}/webinars/${webinarId}/`
    );
    return response.data;
  },
};
