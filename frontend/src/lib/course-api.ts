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
}

export const courseApi = {
  // Get list of courses (paginated or all)
  getCourses: async (params?: CourseListParams) => {
    const response = await apiClient.get<PaginatedResponse<Course> | { data: Course[], success: boolean, message: string }>('/api/courses/v1/courses/', { params });
    return response.data;
  },

  // Get a single course by ID
  getCourse: async (id: number) => {
    const response = await apiClient.get<{ data: Course, success: boolean, message: string }>(`/api/courses/v1/courses/${id}/`);
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

  // Toggle active status
  toggleActive: async (id: number) => {
    const response = await apiClient.post<{ data: null, success: boolean, message: string }>(`/api/courses/v1/courses/${id}/toggle-active/`);
    return response.data;
  },

  // Delete course
  deleteCourse: async (id: number) => {
    const response = await apiClient.delete<{ data: null, success: boolean, message: string }>(`/api/courses/v1/courses/${id}/`);
    return response.data;
  },
};
