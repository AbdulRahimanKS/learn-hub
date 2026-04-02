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

export const dashboardApi = {
  getAdminDashboard: async (): Promise<AdminDashboardData> => {
    const response = await apiClient.get<{ data: AdminDashboardData; success: boolean; message: string }>(
      '/api/courses/v1/dashboard/'
    );
    return response.data.data;
  },
};
