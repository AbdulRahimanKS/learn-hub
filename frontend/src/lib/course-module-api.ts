import { apiClient } from './api';

export interface ClassSession {
  id: number;
  course_week: number;
  session_number: number;
  title: string;
  description: string;
  video_file: string | null;
  video_url: string | null;
  video_presigned_url?: string | null;
  thumbnail: string | null;
  duration_seconds: number;
  weekday?: string | null;
  mcq_questions?: PostSessionQuestion[];
  is_completed?: boolean;
  has_mcq?: boolean;
  uploaded_by?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PostSessionChoice {
  id: number;
  question: number;
  text: string;
  is_correct: boolean;
}

export interface PostSessionQuestion {
  id: number;
  class_session: number;
  text: string;
  is_fill_in_the_blank: boolean;
  order: number;
  choices: PostSessionChoice[];
}

export interface TestQuestionAttachment {
  id: number;
  question: number;
  file: string;
  name: string;
}

export interface WeeklyTestQuestion {
  id: number;
  test: number;
  text: string;
  question_file: string | null;
  image: string | null;
  order: number;
  marks: number;
  attachments?: TestQuestionAttachment[];
}

export interface WeeklyTest {
  id: number;
  course_week: number;
  title: string;
  instructions: string;
  pass_percentage: number;
  answer_key?: string | null;
  questions: WeeklyTestQuestion[];
  created_by?: number;
  updated_by?: number;
  created_at?: string;
  updated_at?: string;
  /** Batch student view: published submission with passing score */
  is_passed?: boolean;
  has_attempted?: boolean;
  latest_submission?: { status?: string; marks_obtained?: number | null } | null;
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
  student_lock_status?: {
    is_locked: boolean;
    reason: 'authentication_required' | 'not_enrolled' | 'date_locked' | 'previous_test_not_passed' | null;
    unlock_date?: string;
  };
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
  
  // --- SESSION MCQs (Course) ---
  createSessionMcq: async (courseId: string | number, weekId: string | number, sessionId: string | number, data: Partial<PostSessionQuestion>) => {
    const response = await apiClient.post<ApiResponse<PostSessionQuestion>>(`/api/courses/v1/courses/${courseId}/weeks/${weekId}/sessions/${sessionId}/mcq/`, data);
    return response.data;
  },
  
  updateSessionMcq: async (courseId: string | number, weekId: string | number, sessionId: string | number, mcqId: string | number, data: Partial<PostSessionQuestion>) => {
    const response = await apiClient.patch<ApiResponse<PostSessionQuestion>>(`/api/courses/v1/courses/${courseId}/weeks/${weekId}/sessions/${sessionId}/mcq/${mcqId}/`, data);
    return response.data;
  },
  
  deleteSessionMcq: async (courseId: string | number, weekId: string | number, sessionId: string | number, mcqId: string | number) => {
    const response = await apiClient.delete<ApiResponse<null>>(`/api/courses/v1/courses/${courseId}/weeks/${weekId}/sessions/${sessionId}/mcq/${mcqId}/`);
    return response.data;
  },

  // --- SESSION MCQs (Batch) ---
  createBatchSessionMcq: async (batchId: string | number, weekId: string | number, sessionId: string | number, data: Partial<PostSessionQuestion>) => {
    const response = await apiClient.post<ApiResponse<PostSessionQuestion>>(`/api/courses/v1/batches/${batchId}/weeks/${weekId}/sessions/${sessionId}/mcq/`, data);
    return response.data;
  },
  
  updateBatchSessionMcq: async (batchId: string | number, weekId: string | number, sessionId: string | number, mcqId: string | number, data: Partial<PostSessionQuestion>) => {
    const response = await apiClient.patch<ApiResponse<PostSessionQuestion>>(`/api/courses/v1/batches/${batchId}/weeks/${weekId}/sessions/${sessionId}/mcq/${mcqId}/`, data);
    return response.data;
  },
  
  deleteBatchSessionMcq: async (batchId: string | number, weekId: string | number, sessionId: string | number, mcqId: string | number) => {
    const response = await apiClient.delete<ApiResponse<null>>(`/api/courses/v1/batches/${batchId}/weeks/${weekId}/sessions/${sessionId}/mcq/${mcqId}/`);
    return response.data;
  },

  // --- TESTS ---
  createTest: async (courseId: string | number, weekId: string | number, formData: FormData) => {
    const response = await apiClient.post<ApiResponse<WeeklyTest>>(`/api/courses/v1/courses/${courseId}/weeks/${weekId}/test/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  updateTest: async (courseId: string | number, weekId: string | number, formData: FormData) => {
    const response = await apiClient.patch<ApiResponse<WeeklyTest>>(`/api/courses/v1/courses/${courseId}/weeks/${weekId}/test/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
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

  // --- ATTACHMENTS ---
  addAttachment: async (courseId: string | number, weekId: string | number, questionId: string | number, formData: FormData) => {
    const response = await apiClient.post<ApiResponse<any>>(`/api/courses/v1/courses/${courseId}/weeks/${weekId}/test/questions/${questionId}/attachments/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  deleteAttachment: async (courseId: string | number, weekId: string | number, questionId: string | number, attachmentId: string | number) => {
    const response = await apiClient.delete<ApiResponse<null>>(`/api/courses/v1/courses/${courseId}/weeks/${weekId}/test/questions/${questionId}/attachments/${attachmentId}/`);
    return response.data;
  },

  // --- MULTIPART UPLOADS ---
  initMultipartUpload: async (filename: string, file_type: string, file_size: number) => {
    const response = await apiClient.post<ApiResponse<any>>(`/api/courses/v1/courses/upload/init/`, {
      filename, file_type, file_size
    });
    return response.data;
  },

  completeMultipartUpload: async (key: string, upload_id: string, parts: { ETag: string, PartNumber: number }[]) => {
    const response = await apiClient.post<ApiResponse<any>>(`/api/courses/v1/courses/upload/complete/`, {
      key, upload_id, parts
    });
    return response.data;
  },

  abortMultipartUpload: async (key: string, upload_id: string) => {
    const response = await apiClient.post<ApiResponse<any>>(`/api/courses/v1/courses/upload/abort/`, {
      key, upload_id
    });
    return response.data;
  },
};
