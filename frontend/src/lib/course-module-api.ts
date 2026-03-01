import { apiClient } from './api';

export interface ClassSession {
  id: number;
  course_week: number;
  session_number: number;
  title: string;
  description: string;
  video_file: string | null;
  video_url: string | null;
  thumbnail: string | null;
  duration_mins: number;
  uploaded_by?: number;
  created_at?: string;
  updated_at?: string;
}

export interface WeeklyTestQuestion {
  id: number;
  test: number;
  text: string;
  question_file: string | null;
  image: string | null;
  order: number;
  marks: number;
}

export interface WeeklyTest {
  id: number;
  course_week: number;
  title: string;
  instructions: string;
  pass_percentage: number;
  questions: WeeklyTestQuestion[];
  created_by?: number;
  updated_by?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CourseWeek {
  id: number;
  course: number;
  week_number: number;
  title: string;
  description: string;
  is_published: boolean;
  class_sessions: ClassSession[];
  weekly_test: WeeklyTest | null;
  created_by?: number;
  updated_by?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export const courseModuleApi = {
  // --- WEEKS ---
  getWeeks: async (courseId: string | number) => {
    const response = await apiClient.get<ApiResponse<CourseWeek[]>>(`/api/courses/v1/courses/${courseId}/weeks/`);
    return response.data;
  },
  
  createWeek: async (courseId: string | number, data: Partial<CourseWeek>) => {
    const response = await apiClient.post<ApiResponse<CourseWeek>>(`/api/courses/v1/courses/${courseId}/weeks/`, data);
    return response.data;
  },
  
  updateWeek: async (courseId: string | number, weekId: string | number, data: Partial<CourseWeek>) => {
    const response = await apiClient.patch<ApiResponse<CourseWeek>>(`/api/courses/v1/courses/${courseId}/weeks/${weekId}/`, data);
    return response.data;
  },
  
  deleteWeek: async (courseId: string | number, weekId: string | number) => {
    const response = await apiClient.delete<ApiResponse<null>>(`/api/courses/v1/courses/${courseId}/weeks/${weekId}/`);
    return response.data;
  },

  // --- SESSIONS ---
  createSession: async (courseId: string | number, weekId: string | number, formData: FormData) => {
    const response = await apiClient.post<ApiResponse<ClassSession>>(`/api/courses/v1/courses/${courseId}/weeks/${weekId}/sessions/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  
  updateSession: async (courseId: string | number, weekId: string | number, sessionId: string | number, formData: FormData) => {
    const response = await apiClient.patch<ApiResponse<ClassSession>>(`/api/courses/v1/courses/${courseId}/weeks/${weekId}/sessions/${sessionId}/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  
  deleteSession: async (courseId: string | number, weekId: string | number, sessionId: string | number) => {
    const response = await apiClient.delete<ApiResponse<null>>(`/api/courses/v1/courses/${courseId}/weeks/${weekId}/sessions/${sessionId}/`);
    return response.data;
  },
  
  // --- TESTS ---
  createTest: async (courseId: string | number, weekId: string | number, data: Partial<WeeklyTest>) => {
    const response = await apiClient.post<ApiResponse<WeeklyTest>>(`/api/courses/v1/courses/${courseId}/weeks/${weekId}/test/`, data);
    return response.data;
  },

  updateTest: async (courseId: string | number, weekId: string | number, data: Partial<WeeklyTest>) => {
    const response = await apiClient.patch<ApiResponse<WeeklyTest>>(`/api/courses/v1/courses/${courseId}/weeks/${weekId}/test/`, data);
    return response.data;
  },

  deleteTest: async (courseId: string | number, weekId: string | number) => {
    const response = await apiClient.delete<ApiResponse<null>>(`/api/courses/v1/courses/${courseId}/weeks/${weekId}/test/`);
    return response.data;
  },

  // --- QUESTIONS ---
  createQuestion: async (courseId: string | number, weekId: string | number, formData: FormData) => {
    const response = await apiClient.post<ApiResponse<WeeklyTestQuestion>>(`/api/courses/v1/courses/${courseId}/weeks/${weekId}/test/questions/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  
  updateQuestion: async (courseId: string | number, weekId: string | number, questionId: string | number, formData: FormData) => {
    const response = await apiClient.patch<ApiResponse<WeeklyTestQuestion>>(`/api/courses/v1/courses/${courseId}/weeks/${weekId}/test/questions/${questionId}/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  
  deleteQuestion: async (courseId: string | number, weekId: string | number, questionId: string | number) => {
    const response = await apiClient.delete<ApiResponse<null>>(`/api/courses/v1/courses/${courseId}/weeks/${weekId}/test/questions/${questionId}/`);
    return response.data;
  },
};
