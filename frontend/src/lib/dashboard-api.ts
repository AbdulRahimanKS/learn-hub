import { apiClient } from './api';

export interface DashboardSummaryStats {
  total_students: number;
  completed_students: number;
  total_batches: number;
  active_courses: number;
  pending_evaluations: number;
}

export interface DashboardBatchOverview {
  id: number;
  name: string;
  course_name: string | null;
  student_count: number;
  progress_pct: number;
  status: string;
}


export interface DashboardPerformance {
  batch_id: number;
  batch_name: string;
  avg_marks: number;
  pass_percent: number;
  total_submissions: number;
}

export interface DashboardEvent {
  id: number;
  type: 'live_session';
  title: string;
  batch_name: string;
  batch_id: number | null;
  scheduled_at: string;
  duration_mins: number;
  meeting_room: string;
}

export interface DashboardChatMessage {
  id: number;
  batch_id: number;
  batch_name: string;
  sender_name: string;
  message: string;
  sent_at: string;
}

export interface AdminDashboardData {
  summary_stats: DashboardSummaryStats;
  batch_overview: DashboardBatchOverview[];
  student_performance: DashboardPerformance[];
  upcoming_events: DashboardEvent[];
  recent_messages: DashboardChatMessage[];
}

export interface StudentDashboardSession {
  id: number;
  title: string;
  duration_label: string;
  completed: boolean;
}

export interface StudentDashboardWeeklyProgressRow {
  week_id: number;
  week_number: number;
  title: string;
  videos_watched: number;
  total_videos: number;
  has_test: boolean;
  test_attempted: boolean;
  test_passed: boolean;
  is_passed: boolean;
}

export interface StudentDashboardFocus {
  enrollment_id: number;
  batch_id: number;
  batch_name: string;
  course_id: number | null;
  course_title: string | null;
  week_id: number;
  week_number: number;
  week_title: string | null;
  week_progress_pct: number;
  videos_completed: number;
  videos_total: number;
  has_weekly_test: boolean;
  weeks_completed: number;
  total_weeks: number;
  sessions: StudentDashboardSession[];
  weekly_progress: StudentDashboardWeeklyProgressRow[];
}

export interface StudentDashboardStats {
  avg_score_pct: number | null;
  sessions_completed: number;
  graded_tests: number;
}

export interface StudentDashboardUpcoming {
  id: string;
  type: 'live_session' | 'webinar';
  title: string;
  subtitle: string;
  scheduled_at: string;
  batch_id: number | null;
  course_id: number | null;
}

export interface StudentDashboardData {
  active_batches: number;
  focus: StudentDashboardFocus | null;
  stats: StudentDashboardStats;
  upcoming: StudentDashboardUpcoming[];
}

export const dashboardApi = {
  getAdminDashboard: async (): Promise<AdminDashboardData> => {
    const response = await apiClient.get<{ data: AdminDashboardData; success: boolean; message: string }>(
      '/api/courses/v1/dashboard/'
    );
    return response.data.data;
  },

  getStudentDashboard: async (): Promise<StudentDashboardData> => {
    const response = await apiClient.get<{ data: StudentDashboardData; success: boolean; message: string }>(
      '/api/courses/v1/dashboard/student/'
    );
    return response.data.data;
  },
};
