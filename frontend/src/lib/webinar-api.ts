import { apiClient } from './api';

export interface Webinar {
  id: number;
  batch: number;
  title: string;
  session_type: 'webinar' | 'special_session';
  description: string;
  unlock_at: string;
  duration_mins: number;
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
  duration_mins: number;
  video_file?: File | null;
}

export const webinarApi = {
  getWebinars: async (batchId: number) => {
    const response = await apiClient.get<{ data: Webinar[]; success: boolean; message: string }>(
      `/api/courses/v1/batches/${batchId}/webinars/`
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
