import { apiClient } from './api';

export interface BatchUser {
  id: number;
  fullname: string;
  email: string;
  user_code: string;
  role: string | null;
}

export interface PaginatedUserResponse {
  current_page: number;
  total_pages: number;
  total_items: number;
  page_size: number;
  next: string | null;
  previous: string | null;
  data: BatchUser[];
}

export interface BatchSummary {
  total_batches: number;
  active_batches: number;
  upcoming_batches: number;
  on_hold_batches: number;
  total_students: number;
}

export interface Batch {
  id: number;
  batch_code: string;
  name: string;
  description: string;
  course: number | null;
  teacher: number | null;
  teacher_name: string | null;
  max_students: number;
  enrolled_count: number;
  is_full: boolean;
  start_date: string | null;
  end_date: string | null;
  duration_weeks: number;
  schedule_type: string;
  class_start_time: string | null;
  class_end_time: string | null;
  fee_amount: string | null;
  fee_currency: string;
  is_free: boolean;
  current_week: number;
  progress_percent: number;
  status: 'upcoming' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  is_active: boolean;
  is_online: boolean;
  meeting_platform: string;
  location: string;
  created_at: string;
  updated_at: string;
}

export interface BatchFormData {
  name: string;
  description?: string;
  course?: number | null;
  teacher?: number | null;
  co_teachers?: number[];
  max_students?: number;
  start_date?: string | null;
  end_date?: string | null;
  duration_weeks?: number;
  status?: string;
  is_active?: boolean;
  is_online?: boolean;
  meeting_platform?: string;
  location?: string;
  fee_amount?: string | null;
  is_free?: boolean;
}

export interface PaginatedBatchResponse {
  current_page: number;
  total_pages: number;
  total_items: number;
  page_size: number;
  next: string | null;
  previous: string | null;
  data: Batch[];
  success: boolean;
  message: string;
}

export interface BatchListParams {
  search?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
  paginate?: boolean;
}

export const batchApi = {
  getBatchSummary: async () => {
    const response = await apiClient.get<{ data: BatchSummary; success: boolean; message: string }>(
      '/api/courses/v1/batches/summary/'
    );
    return response.data.data;
  },

  getBatches: async (params?: BatchListParams) => {
    const response = await apiClient.get<PaginatedBatchResponse | { data: Batch[]; success: boolean; message: string }>(
      '/api/courses/v1/batches/', { params }
    );
    return response.data;
  },

  getBatch: async (id: number) => {
    const response = await apiClient.get<{ data: BatchFormData; success: boolean; message: string }>(
      `/api/courses/v1/batches/${id}/`
    );
    return response.data;
  },

  createBatch: async (data: BatchFormData) => {
    const response = await apiClient.post<{ data: Batch | null; success: boolean; message: string }>(
      '/api/courses/v1/batches/create/', data
    );
    return response.data;
  },

  updateBatch: async (id: number, data: Partial<BatchFormData>) => {
    const response = await apiClient.patch<{ data: Batch | null; success: boolean; message: string }>(
      `/api/courses/v1/batches/${id}/update/`, data
    );
    return response.data;
  },

  deleteBatch: async (id: number) => {
    const response = await apiClient.delete<{ data: null; success: boolean; message: string }>(
      `/api/courses/v1/batches/${id}/`
    );
    return response.data;
  },

  toggleActive: async (id: number) => {
    const response = await apiClient.post<{ data: null; success: boolean; message: string }>(
      `/api/courses/v1/batches/${id}/toggle-active/`
    );
    return response.data;
  },

  addStudent: async (batchId: number, studentId: number) => {
    const response = await apiClient.post<{ data: null; success: boolean; message: string }>(
      `/api/courses/v1/batches/${batchId}/add-student/`, { student: studentId }
    );
    return response.data;
  },
};

export const userApi = {
  listByRole: async (role?: string, search?: string, paginate?: boolean, page?: number) => {
    const response = await apiClient.get<{ data: BatchUser[] | PaginatedUserResponse; success: boolean; message: string }>(
      '/api/users/v1/list/', { params: { role, search, paginate, page } }
    );
    return response.data.data;
  },
};
