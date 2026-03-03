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

export interface BatchWeek {
  id: number;
  batch: number;
  week_number: number;
  title: string;
  description: string;
  unlock_date: string | null;
  is_extended: boolean;
  is_unlocked: boolean;
  is_published: boolean;
  can_modify_content: boolean;
  class_sessions?: any[];
  weekly_test?: any;
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

  cloneContent: async (batchId: number, sourceCourseId?: number, sourceBatchId?: number) => {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      `/api/courses/v1/batches/${batchId}/clone-content/`,
      {},
      { params: { source_course_id: sourceCourseId, source_batch_id: sourceBatchId } }
    );
    return response.data;
  },

  extendTimeline: async (batchId: number, days: number) => {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      `/api/courses/v1/batches/${batchId}/extend-timeline/`,
      {},
      { params: { days } }
    );
    return response.data;
  },
};

export const batchContentApi = {
  getWeeks: async (batchId: number) => {
    const response = await apiClient.get<{ data: BatchWeek[]; success: boolean }>(
      `/api/courses/v1/batches/${batchId}/weeks/`
    );
    return response.data;
  },

  updateWeek: async (batchId: number, weekId: number, data: Partial<BatchWeek>) => {
    const response = await apiClient.patch<{ success: boolean }>(
      `/api/courses/v1/batches/${batchId}/weeks/${weekId}/`,
      data
    );
    return response.data;
  },

  getSessions: async (batchId: number, weekId: number) => {
    const response = await apiClient.get<{ data: any[]; success: boolean }>(
      `/api/courses/v1/batches/${batchId}/weeks/${weekId}/sessions/`
    );
    return response.data;
  },

  getWeeklyTest: async (batchId: number, weekId: number) => {
    const response = await apiClient.get<{ data: any; success: boolean }>(
      `/api/courses/v1/batches/${batchId}/weeks/${weekId}/test/`
    );
    return response.data;
  },

  createSession: async (batchId: number, weekId: number, data: FormData) => {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      `/api/courses/v1/batches/${batchId}/weeks/${weekId}/sessions/`,
      data,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  updateSession: async (batchId: number, weekId: number, sessionId: number, data: FormData) => {
    const response = await apiClient.patch<{ success: boolean; message: string }>(
      `/api/courses/v1/batches/${batchId}/weeks/${weekId}/sessions/${sessionId}/`,
      data,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  deleteSession: async (batchId: number, weekId: number, sessionId: number) => {
    const response = await apiClient.delete<{ success: boolean; message: string }>(
      `/api/courses/v1/batches/${batchId}/weeks/${weekId}/sessions/${sessionId}/`
    );
    return response.data;
  },

  manageWeeklyTest: async (batchId: number, weekId: number, data: any) => {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      `/api/courses/v1/batches/${batchId}/weeks/${weekId}/test/manage/`,
      data
    );
    return response.data;
  },

  deleteWeeklyTest: async (batchId: number, weekId: number) => {
    const response = await apiClient.delete<{ success: boolean; message: string }>(
      `/api/courses/v1/batches/${batchId}/weeks/${weekId}/test/manage/`
    );
    return response.data;
  },

  getTestQuestions: async (batchId: number, weekId: number) => {
    const response = await apiClient.get<{ data: any[]; success: boolean }>(
      `/api/courses/v1/batches/${batchId}/weeks/${weekId}/test/questions/`
    );
    return response.data;
  },

  addTestQuestion: async (batchId: number, weekId: number, data: any) => {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      `/api/courses/v1/batches/${batchId}/weeks/${weekId}/test/questions/`,
      data
    );
    return response.data;
  },

  updateTestQuestion: async (batchId: number, weekId: number, questionId: number, data: any) => {
    const response = await apiClient.patch<{ success: boolean; message: string }>(
      `/api/courses/v1/batches/${batchId}/weeks/${weekId}/test/questions/${questionId}/`,
      data
    );
    return response.data;
  },

  deleteTestQuestion: async (batchId: number, weekId: number, questionId: number) => {
    const response = await apiClient.delete<{ success: boolean; message: string }>(
      `/api/courses/v1/batches/${batchId}/weeks/${weekId}/test/questions/${questionId}/`
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
