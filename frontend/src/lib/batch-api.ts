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
  progress_percent: number;
  is_active: boolean;
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
  is_active?: boolean;
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

  getAvailableStudents: async (search?: string) => {
    const response = await apiClient.get<{ data: BatchUser[]; success: boolean; message: string }>(
      '/api/courses/v1/batches/available-students/', { params: { search } }
    );
    return response.data;
  },

  getBatchStudents: async (batchId: number, params?: { page?: number; page_size?: number }) => {
    const response = await apiClient.get<{ 
      data: any[]; 
      success: boolean; 
      message: string;
      total_count?: number;
      total_pages?: number;
      current_page?: number;
    }>(
      `/api/courses/v1/batches/${batchId}/students/`, { params }
    );
    return response.data;
  },

};


export interface ManageUser {
  id: number;
  user_code: string;
  email: string;
  fullname: string;
  phone_number_code: string;
  contact_number: string;
  role: string | null;
  is_active: boolean;
  profile_picture: string | null;
  created_at: string;
}

export interface ManageUserSummary {
  total_teachers: number;
  total_students: number;
  total_active_students: number;
  total_active_teachers: number;
}

export interface PaginatedManageUsers {
  current_page: number;
  total_pages: number;
  total_items: number;
  page_size: number;
  next: string | null;
  previous: string | null;
  data: ManageUser[];
  summary: ManageUserSummary;
}

export const userApi = {
  listByRole: async (role?: string, search?: string, paginate?: boolean, page?: number) => {
    const response = await apiClient.get<{ data: BatchUser[] | PaginatedUserResponse; success: boolean; message: string }>(
      '/api/users/v1/list/', { params: { role, search, paginate, page } }
    );
    return response.data.data;
  },
  
  manageList: async (params?: { role?: string, search?: string, is_active?: boolean, paginate?: boolean, page?: number, page_size?: number }) => {
    const response = await apiClient.get<{ data: PaginatedManageUsers | { data: ManageUser[], summary: ManageUserSummary }; success: boolean; message: string }>(
      '/api/users/v1/manage/', { params }
    );
    return response.data.data;
  },

  manageCreate: async (data: { role: string, fullname: string, email: string, phone_number_code: string, contact_number: string }) => {
    const response = await apiClient.post<any>('/api/users/v1/manage/', data);
    return response.data;
  },

  manageUpdate: async (id: number, data: { fullname?: string, phone_number_code?: string, contact_number?: string, is_active?: boolean }) => {
    const response = await apiClient.patch<any>(`/api/users/v1/manage/${id}/`, data);
    return response.data;
  },

  manageDelete: async (id: number, force = false) => {
    const response = await apiClient.delete<any>(`/api/users/v1/manage/${id}/`, {
      data: { force },
    });
    return response.data;
  },

  manageSendCredentials: async (id: number) => {
    const response = await apiClient.post<any>(`/api/users/v1/manage/${id}/send-credentials/`);
    return response.data;
  }
};
