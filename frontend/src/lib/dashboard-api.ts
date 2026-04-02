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
  next_unlock_date: string | null;
  status: string;
}

export interface DashboardPendingSubmission {
  submission_id: number;
  student_name: string;
  batch_name: string;
  batch_id: number | null;
  week_number: number | null;
  submitted_at: string;
  status: string;
}

export interface DashboardLiveToday {
  id: number;
  title: string;
  batch_name: string;
  batch_id: number | null;
  scheduled_at: string;
  meeting_room: string;
}

export interface DashboardPendingActions {
  pending_tests: DashboardPendingSubmission[];
  pending_review: DashboardPendingSubmission[];
  live_today: DashboardLiveToday[];
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
  pending_actions: DashboardPendingActions;
  student_performance: DashboardPerformance[];
  upcoming_events: DashboardEvent[];
  recent_messages: DashboardChatMessage[];
}

export const dashboardApi = {
  getAdminDashboard: async (): Promise<AdminDashboardData> => {
    const response = await apiClient.get<{ data: AdminDashboardData; success: boolean; message: string }>(
      '/api/courses/v1/dashboard/'
    );
    return response.data.data;
  },
};
