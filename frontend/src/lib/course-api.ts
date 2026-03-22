import { apiClient } from './api';

export interface Course {
  id: number;
  course_code: string;
  title: string;
  description: string;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  is_active: boolean;
  thumbnail: string | null;
  tags: { id: number; name: string }[];
  total_weeks?: number;
  batch_id?: number | null;
  batch_name?: string | null;
  batch_status?: 'active' | 'completed' | 'dropped' | null;
  batch_student_count?: number | null;
  batch_start_date?: string | null;
  batch_teacher_name?: string | null;
  batch_co_teacher_names?: string[];
  learning_status?: 'start_learning' | 'continue_learning' | 'review';
  progress_percent?: number;
  /** When set, week 1 is calendar-locked until this instant (batch courses). */
  batch_content_starts_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  current_page: number;
  total_pages: number;
  total_items: number;
  page_size: number;
  next: string | null;
  previous: string | null;
  data: T[];
  success: boolean;
  message: string;
}

export interface CourseListParams {
  search?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
  paginate?: boolean;
  /** For students: 'active' | 'completed' or omit for all */
  enrollment_status?: string;
}

export interface CourseMySummary {
  active_count: number;
  completed_count: number;
}

export const courseApi = {
  // Get list of courses (paginated or all)
  getCourses: async (params?: CourseListParams) => {
    const response = await apiClient.get<PaginatedResponse<Course> | { data: Course[]; success: boolean; message: string }>('/api/courses/v1/courses/', { params });
    return response.data;
  },

  getMySummary: async () => {
    const response = await apiClient.get<{ data: CourseMySummary; success: boolean; message: string }>('/api/courses/v1/courses/my-summary/');
    return response.data;
  },

  // Get a single course by ID (optional batch_id for students with multiple enrollments)
  getCourse: async (id: number, params?: { batch_id?: number }) => {
    const response = await apiClient.get<{ data: Course, success: boolean, message: string }>(`/api/courses/v1/courses/${id}/`, { params });
    return response.data;
  },

  // Create a new course (uses FormData)
  createCourse: async (formData: FormData) => {
    const response = await apiClient.post<{ data: Course | null, success: boolean, message: string }>('/api/courses/v1/courses/create/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Update a course (uses FormData)
  updateCourse: async (id: number, formData: FormData) => {
    const response = await apiClient.patch<{ data: Course | null, success: boolean, message: string }>(`/api/courses/v1/courses/${id}/update/`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Delete a course
  deleteCourse: async (id: number) => {
    const response = await apiClient.delete<{ data: null, success: boolean, message: string }>(`/api/courses/v1/courses/${id}/`);
    return response.data;
  },

  // Toggle course active status
  toggleActive: async (id: number) => {
    const response = await apiClient.post<{ data: null, success: boolean, message: string }>(`/api/courses/v1/courses/${id}/toggle-active/`);
    return response.data;
  },
};
